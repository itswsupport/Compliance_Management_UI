import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import SearchableSelect from '../../components/ui/SearchableSelect';
import ComplianceCalendar from '../../components/ui/ComplianceCalendar';
import DashboardNavCards, { clearCardCache, clearSectionCache } from '../../components/ui/DashboardNavCards';
import {
  getPlantList, saveCompliance, getComplianceFlowStatus,
} from '../../services/complianceService';
import { saveNotice } from '../../services/noticeService';
import {
  getActTypeList, getActSubTypeByActType,
} from '../../services/adminService';
import { todayDate, currentTime } from '../../utils/formatters';
import { LS_KEYS, FREQUENCY_OPTIONS } from '../../utils/constants';
import { ACCEPT, FILE_HINT, fileError } from '../../utils/attachments';
import { getPeriod } from '../../utils/periodFilter';
import { fetchComplianceRows, filterByPeriod } from '../../utils/complianceRows';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV_CARDS = NAV_CARDS_BY_SECTION['comp-admin'];

/**
 * What the calendar on this page draws: everything still outstanding.
 *
 * The same set the Overdue and Pending tabs give it, so the calendar shows the
 * same month wherever it is opened from. Approved (1) is absent — it is
 * finished, and has no due date left worth looking at.
 */
const CALENDAR_STATUSES = [0, 3, 4, 11, 2, 5];

// Sentinel for the "all plants" row. Not a plant id, so it can never collide.
const ALL_PLANTS = 'ALL';

// The two things the Compliance Admin raises from this screen. One form serves
// both — plant, category, subcategory and the document are the same question
// either way. All the request type decides is where the form is sent: a
// compliance into the approval flow it has always gone into, a notice straight
// to the Plant HR and Group HR who read it.
const REQUEST_TYPES = [
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'NOTICE',     label: 'Notice' },
];

// notice_subject is varchar(255); 250 leaves headroom. notice_desc is
// varchar(2000). Both counts are shown, so the limit is never met as a
// keystroke that silently does nothing.
const SUBJECT_MAX = 250;
const DESC_MAX    = 2000;

export default function AssignCompliance() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Compliance, because that is what this screen is nearly always used for and
  // what it has always been. The dropdown is still the first field, so raising
  // a notice instead is one click — but the common case costs none.
  const [requestType, setRequestType] = useState('COMPLIANCE');
  // The calendar is a reference while assigning — what is already due, and
  // when — so it sits ABOVE the form rather than replacing it. Replacing would
  // unmount a half-filled form and lose what had been typed.
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarRows, setCalendarRows] = useState([]);

  const [plants, setPlants]       = useState([]);
  const [actTypes, setActTypes]   = useState([]);
  const [subTypes, setSubTypes]   = useState([]);
  const [saving, setSaving]       = useState(false);
  // "n of m" while assigning to every plant — one save per plant, so it is slow
  // enough that a bare spinner reads as a hang.
  const [progress, setProgress]   = useState(null);
  const [errors, setErrors]       = useState({});

  const [form, setForm] = useState({
    plant: '',
    plantCode: '',
    compActType: '',
    compActSubType: '',
    approvalFlowStatus: '',
    compFrequency: '',
    firstDueDate: todayDate(),
    startDate: todayDate(),
    endDate: todayDate(),
    attachment: null,
    // Notice only — a compliance has no description, the same way a notice has
    // no frequency or due date.
    noticeDesc: '',
  });

  // Bumped after a rejected file so the input — which React cannot clear by
  // value — is thrown away and remounted empty.
  const [fileKey, setFileKey] = useState(0);

  useEffect(() => {
    Promise.all([getPlantList(), getActTypeList()]).then(([pRes, aRes]) => {
      // plant_mst carries a "Default Plant" row at plant_code 0 that nothing is
      // ever assigned to. Its status is 1 like every real plant, so the code is
      // the only thing that tells it apart, and plant/list is a bare findAll().
      setPlants((pRes.data?.response || []).filter((p) => Number(p.plantCode) !== 0));
      setActTypes(aRes.data?.response || []);
    });
  }, []);

  function handlePlantChange(e) {
    const opt = e.target.options[e.target.selectedIndex];
    setForm((f) => ({
      ...f,
      plant: e.target.value,
      plantCode: opt.dataset.plantcode || '',
    }));
  }

  async function handleActTypeChange(val) {
    setForm((f) => ({ ...f, compActType: val, compActSubType: '', approvalFlowStatus: '' }));
    setSubTypes([]);
    if (!val) return;
    const res = await getActSubTypeByActType(val);
    setSubTypes(res.data?.response || []);
  }

  /**
   * Switch the form between a compliance and a notice.
   *
   * Plant, category, subcategory and the document are shared, so whatever is
   * already filled in stays. Two things do not survive the switch:
   *
   * - the errors, which belong to the half of the form that is going away;
   * - the approval flow status, which is looked up per category and only for a
   *   compliance. Picking the category as a notice never fetched one, so
   *   switching to compliance has to fetch it now — otherwise the compliance
   *   would save with an empty flow.
   */
  async function handleRequestTypeChange(val) {
    setRequestType(val);
    setErrors({});
    if (val !== 'COMPLIANCE' || !form.compActType || !form.compActSubType) return;
    const res = await getComplianceFlowStatus(form.compActType, form.compActSubType);
    setForm((f) => ({ ...f, approvalFlowStatus: res.data?.response?.approvalFlowStatus || '' }));
  }

  async function handleSubTypeChange(val) {
    setForm((f) => ({ ...f, compActSubType: val }));
    if (!form.compActType || !val) return;
    // A notice has no approval flow — it is published and it is read — so there
    // is no flow status to look up for one.
    if (requestType === 'NOTICE') return;
    const res = await getComplianceFlowStatus(form.compActType, val);
    setForm((f) => ({ ...f, approvalFlowStatus: res.data?.response?.approvalFlowStatus || '' }));
  }

  function validate() {
    const e = {};
    if (!form.plant)          e.plant = 'PLEASE SELECT PLANT';
    if (!form.compActType)    e.compActType = 'PLEASE SELECT COMPLIANCE CATEGORY';
    if (!form.compActSubType) e.compActSubType = 'PLEASE SELECT COMPLIANCE SUBCATEGORY';

    // A notice asks nothing beyond the shared fields. Everything in here is the
    // compliance half, validating exactly as it always has.
    if (requestType !== 'NOTICE') {
      if (!form.compFrequency)  e.compFrequency = 'PLEASE SELECT FREQUENCY';
      if (form.compFrequency === 'AS & WHEN') {
        if (!form.startDate) e.startDate = 'PLEASE SELECT START DATE';
        if (!form.endDate)   e.endDate = 'PLEASE SELECT END DATE';
      } else {
        if (!form.firstDueDate) e.firstDueDate = 'PLEASE SELECT DUE DATE';
      }
    }

    // Required for a compliance act — the document IS the compliance, and there
    // is nothing to submit against without it. Optional for a notice, which can
    // be nothing more than the words in its description.
    //
    // A file that IS chosen is checked either way: oversized or wrongly named is
    // a problem whether or not it had to be there.
    if (requestType !== 'NOTICE' && !form.attachment) {
      e.attachment = 'PLEASE SELECT FILE ATTACHMENT';
    } else if (form.attachment && fileError(form.attachment)) {
      e.attachment = fileError(form.attachment);
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /**
   * Send the form as a notice.
   *
   * No flow of any kind: one request, one save, and it is on the Notice
   * Dashboard for the Plant HR and Group HR it was addressed to. ALL PLANTS is
   * a flag rather than the fan-out a compliance does — the server still writes
   * one row per plant, but a notice mails every compliance user, and 16
   * requests would be 16 identical mails to each of them.
   *
   * The act masters name the category either way; on a notice those same two
   * values are stored as the notice category and subcategory.
   */
  async function submitNotice() {
    const allPlants = form.plant === ALL_PLANTS;

    const fd = new FormData();
    // notice_subject is NOT NULL on the server and it is the SUBJECT column the
    // HRs read on the Notice Dashboard, but the form no longer asks for one.
    // The subcategory is what the admin picked to say what this notice is
    // about, so it is what the subject says too.
    fd.append('noticeSubject', form.compActSubType.slice(0, SUBJECT_MAX));
    fd.append('noticeDesc', form.noticeDesc.trim());
    fd.append('allPlants', String(allPlants));
    if (!allPlants) fd.append('plant', form.plant);
    fd.append('noticeCategory', form.compActType);
    fd.append('noticeSubCategory', form.compActSubType);
    fd.append('regDate', todayDate());
    fd.append('regTime', currentTime());
    fd.append('empCode', user?.empCode || localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE));
    // ...1, matching the server's param name — the entity already owns a String
    // `noticeAttachment`, which the binder would claim first.
    // Only when there is one. FormData turns a null into the STRING "null",
    // which the server would bind as a MultipartFile it cannot read — an absent
    // file has to be an absent field, not an empty-looking one.
    if (form.attachment) fd.append('noticeAttachment1', form.attachment);

    setSaving(true);
    try {
      const res = await saveNotice(fd);
      if (res.data?.status_code === 200) {
        // Only the notice rows. A notice changes no compliance count, so
        // clearing the whole cache made all four compliance cards refetch —
        // and any number that had gone stale since it was first counted
        // corrected itself right then, which read as the notice having
        // changed it.
        clearSectionCache('notice');
        await Swal.fire({
          title: res.data?.message || 'Notice Published Successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
        // Straight to the board the Plant HR and Group HR read it on.
        navigate('/notice/list');
      } else {
        await Swal.fire({
          title: res.data?.message || 'Notice Could Not Be Published',
          icon: 'warning',
          confirmButtonColor: '#42ba96',
        });
      }
    } catch (err) {
      // A refusal comes back with a non-2xx, which axios throws. Its body still
      // carries the reason.
      await Swal.fire({
        title: err?.response?.data?.message || 'An error occurred while publishing the notice',
        icon: 'error',
        confirmButtonColor: '#42ba96',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    // The one place the request type matters. Everything past this line is the
    // compliance flow exactly as it was.
    if (requestType === 'NOTICE') return submitNotice();

    const regDate = todayDate();
    const regTime = currentTime();
    const dateString = form.compFrequency === 'AS & WHEN' ? form.startDate : form.firstDueDate;
    const applicableYear = dateString ? dateString.split('-')[0] : '';

    // ALL PLANTS is a fan-out, not a batch: the endpoint takes one plant, so it
    // is one save per plant. Sequential on purpose — each save writes a file and
    // sends mail, and 16 at once would put that load on the server in one go.
    const targets = form.plant === ALL_PLANTS
      ? plants
      : plants.filter((p) => String(p.id) === String(form.plant));

    if (targets.length === 0) return;

    const buildForm = (p) => {
      const fd = new FormData();
      fd.append('plant', String(p.id));
      fd.append('plantCode', String(p.plantCode));
      fd.append('compActType', form.compActType);
      fd.append('compActSubType', form.compActSubType);
      fd.append('approvalFlowStatus', form.approvalFlowStatus);
      fd.append('compApplicableYear', applicableYear);
      fd.append('compFrequency', form.compFrequency);
      if (form.compFrequency === 'AS & WHEN') {
        fd.append('firstDueDate', form.startDate);
        fd.append('lastDueDate', form.endDate);
      } else {
        fd.append('firstDueDate', form.firstDueDate);
      }
      fd.append('regDate', regDate);
      fd.append('regTime', regTime);
      fd.append('empCode', user?.empCode || localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE));
      fd.append('actAttachment1', form.attachment);
      return fd;
    };

    const titleCase = (msg) => (
      msg && msg === msg.toUpperCase()
        ? msg.toLowerCase().replace(/(^\w|\s\w)/g, (m) => m.toUpperCase())
        : msg
    );

    setSaving(true);
    const failed = [];
    let okCount = 0;
    let okMsg = '';
    try {
      for (let i = 0; i < targets.length; i++) {
        const p = targets[i];
        setProgress({ done: i, total: targets.length });
        try {
          const res = await saveCompliance(buildForm(p));
          if (res.data?.status_code === 200) {
            okCount += 1;
            okMsg = res.data?.message || okMsg;
          } else failed.push({ code: p.plantCode, msg: res.data?.message });
        } catch (err) {
          // A plant with no Plant HR mapped is refused with a non-2xx, which
          // axios throws. Its body still carries the reason.
          failed.push({ code: p.plantCode, msg: err?.response?.data?.message });
        }
      }

      if (okCount > 0) {
        // Whatever was created lands in Pending, so the cached card numbers are
        // out of date — let them be counted again.
        clearCardCache();
      }

      if (failed.length === 0) {
        await Swal.fire({
          title: targets.length > 1
            ? `Compliance Assigned For ${okCount} Plants`
            : titleCase(okMsg) || 'Compliance Act Request Sent Succesfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
        navigate('/comp-admin/pending');
      } else if (okCount > 0) {
        await Swal.fire({
          title: `Assigned For ${okCount} Of ${targets.length} Plants`,
          html: `Could not assign for:<br><b>${failed.map((f) => f.code).join(', ')}</b>`
            + `<br><small>${titleCase(failed[0].msg) || 'Please check the plant mapping.'}</small>`,
          icon: 'warning',
          confirmButtonColor: '#42ba96',
        });
        navigate('/comp-admin/pending');
      } else {
        await Swal.fire({
          title: titleCase(failed[0].msg) || 'Compliance Could Not Be Assigned',
          icon: 'warning',
          confirmButtonColor: '#42ba96',
        });
      }
    } catch {
      await Swal.fire({ title: 'An error occurred while saving the compliance', icon: 'error', confirmButtonColor: '#42ba96' });
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  const isAsWhen     = form.compFrequency === 'AS & WHEN';
  /**
   * Load the calendar's rows the first time it is opened, not on page load.
   *
   * This page exists to assign, not to browse; most visits never open the
   * calendar, and a query nobody asked for would compete with the plant and act
   * lists the form itself needs.
   */
  useEffect(() => {
    if (!calendarOpen || !user || calendarRows.length > 0) return;
    let cancelled = false;
    fetchComplianceRows(user, CALENDAR_STATUSES, '/comp-admin/assign')
      .then((rows) => { if (!cancelled) setCalendarRows(rows); })
      .catch(() => { /* leave it empty; the form is unaffected */ });
    return () => { cancelled = true; };
  }, [calendarOpen, user, calendarRows.length]);


  const isNotice     = requestType === 'NOTICE';
  const isCompliance = requestType === 'COMPLIANCE';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="section-title">
          COMPLIANCE ADMIN DASHBOARD
        </h1>
        {/* Same button, same words and same place as the one on the Pending and
            Overdue tabs, so the calendar is reached the same way wherever the
            admin happens to be standing. */}
        <button
          type="button"
          onClick={() => setCalendarOpen((open) => !open)}
          className="px-2.5 py-1.5 bg-[#3482AE] hover:bg-[#2A6B91] text-white text-[10px] leading-none uppercase rounded-sm border-0 cursor-pointer transition-colors inline-flex items-center gap-1 shrink-0"
        >
          <i className="fas fa-calendar-alt" />
          Compliance Calendar
        </button>
      </div>

      {/* Nav cards — same component the list pages use, so the counts shown
          here are the ones already fetched rather than a second set. */}
      {/* period, like every other screen that draws these cards. This page has
          no filter bar of its own, but the selection is one dashboard-wide
          thing — without it the counts here were the unfiltered ones while
          Pending, Approved, Overdue and the Notice Dashboard all showed
          filtered ones, so the numbers appeared to change on their own when
          moving between them. */}
      <DashboardNavCards cards={NAV_CARDS} period={getPeriod()} />

      {/* Above the form, not instead of it: this page is where a compliance is
          written, and the calendar is what you check while writing it. Swapping
          the form out would unmount it and lose whatever had been entered. */}
      {calendarOpen && (
        <ComplianceCalendar
          data={filterByPeriod(calendarRows, getPeriod().year, getPeriod().month)}
          loading={calendarRows.length === 0}
        />
      )}

      {/* Form card */}
      <div className="card">
        <div className="card-header-info">
          <h3>
            <i className={isNotice ? 'fas fa-bullhorn' : 'fas fa-tasks'} />{' '}
            {isNotice ? 'Add Notice' : 'Assign Compliance'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-3">

              {/* REQUEST TYPE — the first field, because it is the first thing
                  the form needs to know. Nothing below it is asked until it is
                  answered. */}
              <div className="form-group">
                <label className="form-label">REQUEST TYPE <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <SearchableSelect
                  id="sel_request_type"
                  value={requestType}
                  placeholder="Select Request Type"
                  searchable={false}
                  optionClassName="text-gray-800"
                  onChange={(val) => handleRequestTypeChange(val)}
                  options={REQUEST_TYPES}
                />
              </div>

              {/* Everything from here down is the same form for both types. The
                  compliance-only and notice-only fields are marked where they
                  appear; the rest is asked either way. */}

              {/* SELECT PLANT */}
              <div className="form-group">
                <label className="form-label">SELECT PLANT <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <SearchableSelect
                  id="sel_plant"
                  value={form.plant}
                  placeholder="Select Plant"
                  optionClassName="text-gray-800"
                  onChange={(val) => {
                    const p = plants.find((x) => String(x.id) === String(val));
                    setForm((f) => ({
                      ...f,
                      plant: val,
                      plantCode: p ? p.plantCode : '',
                    }));
                  }}
                  options={[
                    { value: ALL_PLANTS, label: 'ALL PLANTS' },
                    ...plants.map((p) => ({
                      value: String(p.id),
                      label: `${p.plantName} - ${p.plantCode}`,
                    })),
                  ]}
                />
                {errors.plant && <p className="text-red-500 text-[10px] mt-1">{errors.plant}</p>}
              </div>

              {/* CATEGORY — the compliance act masters either way, and named
                  after them either way. A notice stores the same two values as
                  its category and subcategory, but the admin is picking from
                  one list and it is labelled the same whichever way it goes. */}
              <div className="form-group">
                <label className="form-label">COMPLIANCE CATEGORY</label>
                <SearchableSelect
                  id="sel_comp_act_type_list"
                  value={form.compActType}
                  placeholder="Select Compliance Category"
                  optionClassName="text-gray-800"
                  onChange={(val) => handleActTypeChange(val)}
                  options={actTypes.map((a) => ({
                    value: a.complianceActType,
                    label: a.complianceActType,
                  }))}
                />
                {errors.compActType && <p className="text-red-500 text-[10px] mt-1">{errors.compActType}</p>}
              </div>

              {/* SUBCATEGORY */}
              <div className="form-group">
                <label className="form-label">COMPLIANCE SUBCATEGORY</label>
                <SearchableSelect
                  id="comp_act_desc"
                  value={form.compActSubType}
                  placeholder="Select Compliance Subcategory"
                  optionClassName="text-gray-800"
                  disabled={!form.compActType}
                  onChange={(val) => handleSubTypeChange(val)}
                  options={subTypes.map((s) => ({
                    value: s.complianceActSubType,
                    label: s.complianceActSubType,
                  }))}
                />
                {errors.compActSubType && <p className="text-red-500 text-[10px] mt-1">{errors.compActSubType}</p>}
              </div>

              {/* FREQUENCY — compliance only. A notice happens once. */}
              {isCompliance && (
              <div className="form-group">
                <label className="form-label">FREQUENCY</label>
                <SearchableSelect
                  id="sel_frequency"
                  value={form.compFrequency}
                  placeholder="Select Frequency"
                  searchable={false}
                  optionClassName="text-gray-800"
                  onChange={(val) => setForm((f) => ({ ...f, compFrequency: val }))}
                  options={FREQUENCY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                {errors.compFrequency && <p className="text-red-500 text-[10px] mt-1">{errors.compFrequency}</p>}
              </div>
              )}

              {/* Conditional Date fields — compliance only, for the same reason:
                  a notice has no due date, only the day it went out. */}
              {isCompliance && form.compFrequency && (
                <>
                  {isAsWhen ? (
                    <>
                      <div className="form-group relative">
                        <label className="form-label">START DATE</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="form-input w-full bg-white cursor-pointer pr-7"
                            value={form.startDate}
                            readOnly
                            placeholder="YYYY-MM-DD"
                            onClick={() => {
                              const el = document.getElementById('hidden_start_date');
                              if (el) {
                                try { el.showPicker(); } catch (err) {}
                              }
                            }}
                          />
                          <input
                            type="date"
                            id="hidden_start_date"
                            min={todayDate()}
                            className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                            value={form.startDate}
                            onChange={(e) => {
                              if (e.target.value) {
                                setForm((f) => ({ ...f, startDate: e.target.value }));
                              }
                            }}
                          />
                          {/* The visible field is a read-only text box — the
                              real <input type="date"> sits behind it at
                              opacity-0 and is opened by showPicker(). Without
                              this glyph the box looked like a plain text field
                              and gave no sign it was a date at all.

                              pointer-events-none so the click falls through to
                              the text box, which is what opens the picker. */}
                          <i className="fas fa-calendar-alt absolute right-2 top-1/2 -translate-y-1/2 text-[#3482AE] text-[12px] pointer-events-none" />
                        </div>
                        {errors.startDate && <p className="text-red-500 text-[10px] mt-1">{errors.startDate}</p>}
                      </div>
                      <div className="form-group relative">
                        <label className="form-label">END DATE</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="form-input w-full bg-white cursor-pointer pr-7"
                            value={form.endDate}
                            readOnly
                            placeholder="YYYY-MM-DD"
                            onClick={() => {
                              const el = document.getElementById('hidden_end_date');
                              if (el) {
                                try { el.showPicker(); } catch (err) {}
                              }
                            }}
                          />
                          <input
                            type="date"
                            id="hidden_end_date"
                            min={todayDate()}
                            className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                            value={form.endDate}
                            onChange={(e) => {
                              if (e.target.value) {
                                setForm((f) => ({ ...f, endDate: e.target.value }));
                              }
                            }}
                          />
                          {/* The visible field is a read-only text box — the
                              real <input type="date"> sits behind it at
                              opacity-0 and is opened by showPicker(). Without
                              this glyph the box looked like a plain text field
                              and gave no sign it was a date at all.

                              pointer-events-none so the click falls through to
                              the text box, which is what opens the picker. */}
                          <i className="fas fa-calendar-alt absolute right-2 top-1/2 -translate-y-1/2 text-[#3482AE] text-[12px] pointer-events-none" />
                        </div>
                        {errors.endDate && <p className="text-red-500 text-[10px] mt-1">{errors.endDate}</p>}
                      </div>
                    </>
                  ) : (
                    <div className="form-group relative">
                      <label className="form-label">DUE DATE</label>
                      <div className="relative">
                        <input
                          type="text"
                          className="form-input w-full bg-white cursor-pointer pr-7"
                          value={form.firstDueDate}
                          readOnly
                          placeholder="YYYY-MM-DD"
                          onClick={() => {
                            const el = document.getElementById('hidden_due_date');
                            if (el) {
                              try { el.showPicker(); } catch (err) {}
                            }
                          }}
                        />
                        <input
                          type="date"
                          id="hidden_due_date"
                          min={todayDate()}
                          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                          value={form.firstDueDate}
                          onChange={(e) => {
                            if (e.target.value) {
                              setForm((f) => ({ ...f, firstDueDate: e.target.value }));
                            }
                          }}
                        />
                          {/* The visible field is a read-only text box — the
                              real <input type="date"> sits behind it at
                              opacity-0 and is opened by showPicker(). Without
                              this glyph the box looked like a plain text field
                              and gave no sign it was a date at all.

                              pointer-events-none so the click falls through to
                              the text box, which is what opens the picker. */}
                          <i className="fas fa-calendar-alt absolute right-2 top-1/2 -translate-y-1/2 text-[#3482AE] text-[12px] pointer-events-none" />
                      </div>
                      {errors.firstDueDate && <p className="text-red-500 text-[10px] mt-1">{errors.firstDueDate}</p>}
                    </div>
                  )}
                </>
              )}

              {/* ATTACHMENT — the same field, the same words, either way. */}
              <div className="form-group">
                <label className="form-label">
                  ATTACHMENT <span className="text-[#FF0000] ml-0.5 text-[11px] font-normal">(COMPLIANCE ACT/NOTIFICATION DOCUMENT.)</span>
                  {isNotice
                    ? <span className="text-gray-400 font-normal normal-case ml-1">(optional)</span>
                    : <span className="text-red-500 font-bold ml-0.5">*</span>}
                </label>
                <input
                  key={fileKey}
                  type="file"
                  accept={ACCEPT}
                  className="form-input w-full bg-white"
                  onChange={(e) => {
                    const file = e.target.files[0] || null;
                    const problem = fileError(file);
                    // A rejected file is not kept: leaving it in state would show
                    // its name under an error, as though it were still going.
                    if (problem) setFileKey((k) => k + 1);
                    setForm((f) => ({ ...f, attachment: problem ? null : file }));
                    setErrors((prev) => ({ ...prev, attachment: problem }));
                  }}
                />
                {/* leading-4 on both, so the line under the file input is
                    always exactly 20px tall whichever of the two is showing. */}
                {errors.attachment
                  ? <p className="text-red-500 text-[10px] leading-4 mt-1">{errors.attachment}</p>
                  : <p className="text-[10px] leading-4 text-gray-400 mt-1">{FILE_HINT}</p>}
              </div>

              {/* NOTICE DESCRIPTION — notice only, and optional. One column
                  like every other field, not a full-width row, so it sits in
                  the third column beside ATTACHMENT: a notice fills five cells
                  before it, and this is the sixth.

                  The comment box from Compliance View — same resize handle,
                  same count over the right-hand corner — but sized to end level
                  with the file input's hint line rather than at the h-32 that
                  suited a full-width row. Still drag-resizable past that. */}
              {isNotice && (
              <div className="form-group">
                <div className="flex items-baseline justify-between gap-2">
                  <label className="form-label !mb-0">
                    NOTICE DESCRIPTION
                    <span className="text-gray-400 font-normal normal-case ml-1">(optional)</span>
                  </label>
                  <span className="text-[10px] text-gray-400 shrink-0 leading-none">
                    {form.noticeDesc.length}/{DESC_MAX}
                  </span>
                </div>
                <textarea
                  className="form-input w-full bg-white text-xs h-[72px] pt-2 mt-1 resize-y min-h-[60px]"
                  value={form.noticeDesc}
                  maxLength={DESC_MAX}
                  placeholder="ENTER NOTICE DESCRIPTION ..."
                  onChange={(e) => setForm((f) => ({ ...f, noticeDesc: e.target.value.slice(0, DESC_MAX) }))}
                />
              </div>
              )}

            </div>
          </div>

          {/* Footer buttons */}
          <div className="border-t border-gray-200 px-5 py-4 flex justify-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn text-white bg-[#3482AE] hover:bg-[#2A6B91] px-5 py-1.5 rounded uppercase font-bold text-xs border-0 cursor-pointer min-w-24 flex items-center justify-center gap-1.5"
              id="addComplianceButton"
            >
              {saving ? (
                <>
                  <span className="loading-spinner" />
                  {progress && progress.total > 1
                    ? `Assigning ${progress.done + 1} of ${progress.total}…`
                    : 'Processing…'}
                </>
              ) : (
                'SUBMIT'
              )}
            </button>
            <button
              type="button"
              id="btnCancel"
              onClick={() => navigate(-1)}
              className="btn text-white bg-[#df4759] hover:bg-[#c93c4e] px-5 py-1.5 rounded uppercase font-bold text-xs border-0 cursor-pointer min-w-24 flex items-center justify-center gap-1.5"
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}