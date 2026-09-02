import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { getActTypeList, getActSubTypeByActType } from '../../services/adminService';
import { getLegalNoticePlants, saveLegalNotice } from '../../services/legalNoticeService';
import { todayDate, currentTime } from '../../utils/formatters';
import { LS_KEYS } from '../../utils/constants';
import { ACCEPT, FILE_HINT, fileError } from '../../utils/attachments';

// Kept under the notice_desc column, which is varchar(2000). The count is shown
// so the limit is never met as a keystroke that silently does nothing — the same
// treatment the Add Notice and Compliance View forms give their long fields.
const DESC_MAX = 2000;
const EMPTY_FORM = {
  plant: '',
  noticeDesc: '',
  noticeCategory: '',
  noticeSubCategory: '',
  dueDate: '',
  attachment: null,
};

/**
 * The Add Legal Notice form.
 *
 * The bare form, with no card of its own: the Legal Notice dashboard renders it
 * inside the card the tabs share, so a second card would nest one inside the
 * other. That is its only host, and the host is what decides only a Plant HR
 * reaches it — there is no role check here.
 *
 * Unlike Add Notice there is no ALL PLANTS row. A legal notice is raised against
 * one plant the raiser is Plant HR of, and the plant is part of its number.
 *
 * @param {function} onSaved called once a legal notice is raised
 * @param {function} onCancel leave the form without raising one
 */
export default function AddLegalNotice({ onSaved, onCancel }) {
  const { user } = useAuth();

  const [plants, setPlants]     = useState([]);
  const [actTypes, setActTypes] = useState([]);
  const [subTypes, setSubTypes] = useState([]);
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState({});
  const [form, setForm]         = useState(EMPTY_FORM);
  // Bumped after a save so the file input — which React cannot clear by value —
  // is thrown away and remounted empty.
  const [fileKey, setFileKey]   = useState(0);

  useEffect(() => {
    if (!user?.empCode) return;
    Promise.all([getLegalNoticePlants(user.empCode), getActTypeList()])
      .then(([pRes, aRes]) => {
        const list = pRes.data?.response || [];
        setPlants(list);
        setActTypes(aRes.data?.response || []);
        // One plant is not a choice. A Plant HR who holds a single plant should
        // not have to tell the form the only thing it could possibly be, so it
        // is selected for them; four plants is a real question and is asked.
        if (list.length === 1) {
          setForm((f) => ({ ...f, plant: String(list[0].id) }));
        }
      })
      .catch(() => {
        // Leave the dropdowns empty rather than blocking the form — validate()
        // will still refuse a save with no plant.
      });
  }, [user?.empCode]);

  const onlyPlant = plants.length === 1;

  async function handleActTypeChange(val) {
    setForm((f) => ({ ...f, noticeCategory: val, noticeSubCategory: '' }));
    setSubTypes([]);
    if (!val) return;
    const res = await getActSubTypeByActType(val);
    setSubTypes(res.data?.response || []);
  }

  function validate() {
    const e = {};
    if (!form.plant)                     e.plant = 'PLEASE SELECT PLANT';
    if (!form.noticeCategory)            e.noticeCategory = 'PLEASE SELECT CATEGORY';
    if (!form.noticeSubCategory)         e.noticeSubCategory = 'PLEASE SELECT SUBCATEGORY';
    if (!form.dueDate)                   e.dueDate = 'PLEASE SELECT DUE DATE';
    // Checked as well as being blocked by the picker's `min`: a date can still
    // be typed into the field, and on some browsers pasted past it.
    else if (form.dueDate < todayDate()) e.dueDate = 'DUE DATE CANNOT BE IN THE PAST';
    if (!form.attachment)                e.attachment = 'PLEASE SELECT FILE ATTACHMENT';
    else if (fileError(form.attachment)) e.attachment = fileError(form.attachment);
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function resetForm() {
    // The pre-selected plant survives a reset, because it was never a choice —
    // clearing it would leave the form in a state the user cannot re-create.
    setForm({ ...EMPTY_FORM, plant: onlyPlant ? String(plants[0].id) : '' });
    setSubTypes([]);
    setErrors({});
    setFileKey((k) => k + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const fd = new FormData();
    fd.append('plant', form.plant);
    // No noticeSubject: the server composes it from the category and
    // subcategory, the way the compliance flow composes its own references.
    fd.append('noticeDesc', form.noticeDesc.trim());
    fd.append('noticeCategory', form.noticeCategory);
    fd.append('noticeSubCategory', form.noticeSubCategory);
    fd.append('dueDate', form.dueDate);
    fd.append('regDate', todayDate());
    fd.append('regTime', currentTime());
    fd.append('empCode', user?.empCode || localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE));
    // ...1, matching the server's param name — the entity already owns a String
    // `noticeAttachment`, which the binder would claim first.
    fd.append('noticeAttachment1', form.attachment);

    setSaving(true);
    try {
      const res = await saveLegalNotice(fd);
      if (res.data?.status_code === 200) {
        await Swal.fire({
          title: res.data?.message || 'Legal Notice Added Successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
        resetForm();
        onSaved?.();
      } else {
        await Swal.fire({
          title: res.data?.message || 'Legal Notice Could Not Be Added',
          icon: 'warning',
          confirmButtonColor: '#42ba96',
        });
      }
    } catch (err) {
      // A refusal comes back with a non-2xx, which axios throws. Its body still
      // carries the reason.
      await Swal.fire({
        title: err?.response?.data?.message || 'An error occurred while adding the legal notice',
        icon: 'error',
        confirmButtonColor: '#42ba96',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-3 items-start">

          {/* SELECT PLANT */}
          <div className="form-group">
            <label className="form-label">
              SELECT PLANT <span className="text-red-500 font-bold ml-0.5">*</span>
            </label>
            <SearchableSelect
              id="sel_legal_notice_plant"
              value={form.plant}
              placeholder="Select Plant"
              optionClassName="text-gray-800"
              // Locked when there is only one — it is the answer, not a choice.
              disabled={onlyPlant}
              onChange={(val) => setForm((f) => ({ ...f, plant: val }))}
              options={plants.map((p) => ({
                value: String(p.id),
                label: `${p.plantName} - ${p.plantCode}`,
              }))}
            />
            {errors.plant && <p className="text-red-500 text-[10px] mt-1">{errors.plant}</p>}
          </div>

          {/* CATEGORY */}
          <div className="form-group">
            <label className="form-label">
              CATEGORY <span className="text-red-500 font-bold ml-0.5">*</span>
            </label>
            <SearchableSelect
              id="sel_legal_notice_act_type"
              value={form.noticeCategory}
              placeholder="Select Category"
              optionClassName="text-gray-800"
              onChange={(val) => handleActTypeChange(val)}
              options={actTypes.map((a) => ({
                value: a.complianceActType,
                label: a.complianceActType,
              }))}
            />
            {errors.noticeCategory && <p className="text-red-500 text-[10px] mt-1">{errors.noticeCategory}</p>}
          </div>

          {/* SUBCATEGORY */}
          <div className="form-group">
            <label className="form-label">
              SUBCATEGORY <span className="text-red-500 font-bold ml-0.5">*</span>
            </label>
            <SearchableSelect
              id="sel_legal_notice_act_sub_type"
              value={form.noticeSubCategory}
              placeholder="Select Subcategory"
              optionClassName="text-gray-800"
              disabled={!form.noticeCategory}
              onChange={(val) => setForm((f) => ({ ...f, noticeSubCategory: val }))}
              options={subTypes.map((s) => ({
                value: s.complianceActSubType,
                label: s.complianceActSubType,
              }))}
            />
            {errors.noticeSubCategory && <p className="text-red-500 text-[10px] mt-1">{errors.noticeSubCategory}</p>}
          </div>

          {/* DUE DATE */}
          <div className="form-group">
            <label className="form-label">
              DUE DATE <span className="text-red-500 font-bold ml-0.5">*</span>
            </label>
            {/* The same date control the Assign Compliance form uses: a
                read-only text box with a calendar glyph, and the real date
                input behind it at opacity-0, opened by showPicker(). A bare
                <input type="date"> renders differently in every browser and
                gave no consistent sign it was a date at all. */}
            <div className="relative">
              <input
                type="text"
                className="form-input w-full bg-white cursor-pointer pr-7"
                value={form.dueDate}
                readOnly
                placeholder="YYYY-MM-DD"
                onClick={() => {
                  const el = document.getElementById('hidden_legal_due_date');
                  if (el) {
                    try { el.showPicker(); } catch { /* not user-activated */ }
                  }
                }}
              />
              <input
                type="date"
                id="hidden_legal_due_date"
                // Today is the earliest a legal notice can be due — it is being
                // raised now, so a date already gone could never be met. The
                // browser greys out everything before it; validate() and the
                // server both check it again, since `min` only guides the picker.
                min={todayDate()}
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                value={form.dueDate}
                onChange={(e) => {
                  if (e.target.value) setForm((f) => ({ ...f, dueDate: e.target.value }));
                }}
              />
              <i className="fas fa-calendar-alt absolute right-2 top-1/2 -translate-y-1/2 text-[#3482AE] text-[12px] pointer-events-none" />
            </div>
            {/* leading-4 on both, so the line under the field is the same height
                whichever is showing — it shares a row with the file input, whose
                hint line is always present. */}
            {errors.dueDate
              ? <p className="text-red-500 text-[10px] leading-4 mt-1">{errors.dueDate}</p>
              : <p className="text-[10px] leading-4 text-gray-400 mt-1">When this notice must be closed by</p>}
          </div>

          {/* ATTACHMENT */}
          <div className="form-group">
            <label className="form-label">
              ATTACHMENT <span className="text-[#FF0000] ml-0.5 text-[11px] font-normal">(LEGAL NOTICE DOCUMENT.)</span>
              <span className="text-red-500 font-bold ml-0.5">*</span>
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
                setForm((f) => ({ ...f, attachment: problem ? null : file }));
                setErrors((prev) => ({ ...prev, attachment: problem }));
                if (problem) setFileKey((k) => k + 1);
              }}
            />
            {errors.attachment
              ? <p className="text-red-500 text-[10px] leading-4 mt-1">{errors.attachment}</p>
              : <p className="text-[10px] leading-4 text-gray-400 mt-1">{FILE_HINT}</p>}
          </div>

          {/* DESCRIPTION — third cell of this row, immediately right of
              ATTACHMENT. It was full width below, which left the cell beside
              the attachment empty and pushed the only optional field onto a row
              of its own. */}
          <div className="form-group">
            <div className="flex items-baseline justify-between gap-2">
              <label className="form-label !mb-0">
                LEGAL NOTICE DESCRIPTION
                <span className="text-gray-400 font-normal normal-case ml-1">(optional)</span>
              </label>
              <span className="text-[10px] text-gray-400 shrink-0 leading-none">
                {form.noticeDesc.length}/{DESC_MAX}
              </span>
            </div>
            <textarea
              className="form-input w-full bg-white text-xs h-[74px] pt-2 mt-1 resize-y min-h-[60px]"
              value={form.noticeDesc}
              maxLength={DESC_MAX}
              placeholder="ENTER LEGAL NOTICE DESCRIPTION ..."
              onChange={(e) => setForm((f) => ({ ...f, noticeDesc: e.target.value.slice(0, DESC_MAX) }))}
            />
          </div>

        </div>
      </div>

      <div className="border-t border-gray-200 px-5 py-4 flex justify-center gap-3">
        <button
          type="submit"
          disabled={saving}
          id="addLegalNoticeButton"
          className="btn text-white bg-[#3482AE] hover:bg-[#2A6B91] px-5 py-1.5 rounded uppercase font-bold text-xs border-0 cursor-pointer min-w-24 flex items-center justify-center gap-1.5"
        >
          {saving ? (<><span className="loading-spinner" /> Processing…</>) : 'SUBMIT'}
        </button>
        {/* Cancel rather than Reset: unlike Add Notice this form is a tab, so
            there IS somewhere to go back to — the list behind it. */}
        <button
          type="button"
          id="btnCancelLegalNotice"
          onClick={onCancel}
          disabled={saving}
          className="btn text-white bg-[#df4759] hover:bg-[#c93c4e] px-5 py-1.5 rounded uppercase font-bold text-xs border-0 cursor-pointer min-w-24 flex items-center justify-center gap-1.5"
        >
          CANCEL
        </button>
      </div>
    </form>
  );
}
