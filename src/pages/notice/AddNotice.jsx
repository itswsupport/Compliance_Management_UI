import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { getPlantList } from '../../services/complianceService';
import { getActTypeList, getActSubTypeByActType } from '../../services/adminService';
import { saveNotice } from '../../services/noticeService';
import { todayDate, currentTime } from '../../utils/formatters';
import { LS_KEYS } from '../../utils/constants';
import { ACCEPT, FILE_HINT, fileError } from '../../utils/attachments';

// Sentinel for the "all plants" row, exactly as Assign Compliance uses it. Not a
// plant id, so it can never collide with one.
const ALL_PLANTS = 'ALL';

// Kept under the compliance_notice.notice_desc column, which is varchar(2000).
// The count is shown, so the limit is never met as a keystroke that silently
// does nothing — the same treatment COMMENT gets in Compliance View.
const DESC_MAX = 2000;
// notice_subject is varchar(255); 250 leaves the same headroom the form had.
const SUBJECT_MAX = 250;

const EMPTY_FORM = {
  noticeSubject: '',
  noticeDesc: '',
  plant: '',
  noticeCategory: '',
  noticeSubCategory: '',
  attachment: null,
};

/**
 * The Add Notice form.
 *
 * The bare form, with no card or header of its own: Assign Compliance renders
 * it inside its own card, under the request type that chose it, and a second
 * card would nest one inside the other. That is its only host, and it is the
 * host that decides only the Compliance Admin reaches it, so there is no role
 * check here.
 *
 * A notice carries no approval flow — it is published and it is read. There is
 * nothing to route it to and nothing to wait for.
 *
 * @param {function} onSaved called once a notice is published
 */
export default function AddNotice({ onSaved }) {
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
    Promise.all([getPlantList(), getActTypeList()]).then(([pRes, aRes]) => {
      // Same filter Assign Compliance applies: plant_mst carries a "Default Plant"
      // row at plant_code 0 that nothing is ever assigned to.
      setPlants((pRes.data?.response || []).filter((p) => Number(p.plantCode) !== 0));
      setActTypes(aRes.data?.response || []);
    });
  }, []);

  async function handleActTypeChange(val) {
    setForm((f) => ({ ...f, noticeCategory: val, noticeSubCategory: '' }));
    setSubTypes([]);
    if (!val) return;
    const res = await getActSubTypeByActType(val);
    setSubTypes(res.data?.response || []);
  }

  function validate() {
    const e = {};
    if (!form.noticeSubject.trim()) e.noticeSubject = 'PLEASE ENTER NOTICE SUBJECT';
    if (!form.plant)                e.plant = 'PLEASE SELECT PLANT';
    if (!form.noticeCategory)          e.noticeCategory = 'PLEASE SELECT NOTICE CATEGORY';
    if (!form.noticeSubCategory)       e.noticeSubCategory = 'PLEASE SELECT NOTICE SUBCATEGORY';
    if (!form.attachment)           e.attachment = 'PLEASE SELECT FILE ATTACHMENT';
    else if (fileError(form.attachment)) e.attachment = fileError(form.attachment);
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setSubTypes([]);
    setErrors({});
    setFileKey((k) => k + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const allPlants = form.plant === ALL_PLANTS;

    // ALL PLANTS is one request, not a loop over plants the way Assign Compliance
    // does it. The server still writes one row per plant — but a notice mails
    // every compliance user, and 16 requests would be 16 identical mails to each
    // of them.
    const fd = new FormData();
    fd.append('noticeSubject', form.noticeSubject.trim());
    fd.append('noticeDesc', form.noticeDesc.trim());
    fd.append('allPlants', String(allPlants));
    if (!allPlants) fd.append('plant', form.plant);
    fd.append('noticeCategory', form.noticeCategory);
    fd.append('noticeSubCategory', form.noticeSubCategory);
    fd.append('regDate', todayDate());
    fd.append('regTime', currentTime());
    fd.append('empCode', user?.empCode || localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE));
    // ...1, matching the server's param name — the entity already owns a String
    // `noticeAttachment`, which the binder would claim first.
    fd.append('noticeAttachment1', form.attachment);

    setSaving(true);
    try {
      const res = await saveNotice(fd);
      if (res.data?.status_code === 200) {
        await Swal.fire({
          title: res.data?.message || 'Notice Published Successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
        // The board is on the same screen, so the new notice appears where the
        // user already is — nothing to navigate to.
        resetForm();
        onSaved?.();
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

  return (
      <form onSubmit={handleSubmit} noValidate>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-3">

            {/* SELECT PLANT */}
            <div className="form-group">
              <label className="form-label">SELECT PLANT <span className="text-red-500 font-bold ml-0.5">*</span></label>
              <SearchableSelect
                id="sel_notice_plant"
                value={form.plant}
                placeholder="Select Plant"
                optionClassName="text-gray-800"
                onChange={(val) => setForm((f) => ({ ...f, plant: val }))}
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

            {/* NOTICE CATEGORY */}
            <div className="form-group">
              <label className="form-label">NOTICE CATEGORY</label>
              <SearchableSelect
                id="sel_notice_act_type"
                value={form.noticeCategory}
                placeholder="Select Notice Category"
                optionClassName="text-gray-800"
                onChange={(val) => handleActTypeChange(val)}
                options={actTypes.map((a) => ({
                  value: a.complianceActType,
                  label: a.complianceActType,
                }))}
              />
              {errors.noticeCategory && <p className="text-red-500 text-[10px] mt-1">{errors.noticeCategory}</p>}
            </div>

            {/* NOTICE SUBCATEGORY */}
            <div className="form-group">
              <label className="form-label">NOTICE SUBCATEGORY</label>
              <SearchableSelect
                id="sel_notice_act_sub_type"
                value={form.noticeSubCategory}
                placeholder="Select Notice Subcategory"
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

            {/* SUBJECT */}
            <div className="form-group md:col-span-2">
              {/* The count rides on the label line. Under the field it needed a
                  row of its own, and that row sat between every input and the
                  next label whether or not anyone was typing. */}
              <div className="flex items-baseline justify-between gap-2">
                <label className="form-label !mb-0">NOTICE SUBJECT <span className="text-red-500 font-bold ml-0.5">*</span></label>
                <span className="text-[10px] text-gray-400 shrink-0 leading-none">
                  {form.noticeSubject.length}/{SUBJECT_MAX}
                </span>
              </div>
              <input
                type="text"
                className="form-input w-full bg-white mt-1"
                value={form.noticeSubject}
                maxLength={SUBJECT_MAX}
                placeholder="Enter notice subject"
                onChange={(e) => setForm((f) => ({ ...f, noticeSubject: e.target.value.slice(0, SUBJECT_MAX) }))}
              />
              {errors.noticeSubject && <p className="text-red-500 text-[10px] mt-1">{errors.noticeSubject}</p>}
            </div>

            {/* ATTACHMENT */}
            <div className="form-group">
              <label className="form-label">
                ATTACHMENT <span className="text-[#FF0000] ml-0.5 text-[11px] font-normal">(NOTICE DOCUMENT.)</span> <span className="text-red-500 font-bold ml-0.5">*</span>
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
              {/* leading-4 on both, so the line under the file input is always
                  exactly 20px tall (mt-1 + 16px) whichever of the two is showing
                  — the height the description below cancels out. */}
              {errors.attachment
                ? <p className="text-red-500 text-[10px] leading-4 mt-1">{errors.attachment}</p>
                : <p className="text-[10px] leading-4 text-gray-400 mt-1">{FILE_HINT}</p>}
            </div>

            {/* DESCRIPTION — the comment box from Compliance View: same classes,
                same resize handle, same count under the right-hand corner.

                -mt-5 from md up: SUBJECT shares its row with ATTACHMENT, and the
                hint line under the file input makes that row 20px taller than
                the subject cell needs — dead space that sat between the subject
                input and this label. Pulling back those 20px leaves the same
                gap-y-3 every other row has. Only from md: below it the columns
                stack, and there the hint really is the line above this one. */}
            <div className="form-group md:col-span-3 md:-mt-4">
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
                className="form-input w-full bg-white text-xs h-32 pt-2 mt-1 resize-y min-h-[60px]"
                value={form.noticeDesc}
                maxLength={DESC_MAX}
                placeholder="ENTER NOTICE DESCRIPTION ..."
                onChange={(e) => setForm((f) => ({ ...f, noticeDesc: e.target.value.slice(0, DESC_MAX) }))}
              />
            </div>

          </div>
        </div>

        <div className="border-t border-gray-200 px-5 py-4 flex justify-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn text-white bg-[#3482AE] hover:bg-[#2A6B91] px-5 py-1.5 rounded uppercase font-bold text-xs border-0 cursor-pointer min-w-24 flex items-center justify-center gap-1.5"
            id="addNoticeButton"
          >
            {saving ? (<><span className="loading-spinner" /> Processing…</>) : 'SUBMIT'}
          </button>
          {/* Reset, not Cancel — there is nowhere to go back to now that the form
              lives on the dashboard itself. */}
          <button
            type="button"
            id="btnResetNotice"
            onClick={resetForm}
            disabled={saving}
            className="btn text-white bg-[#df4759] hover:bg-[#c93c4e] px-5 py-1.5 rounded uppercase font-bold text-xs border-0 cursor-pointer min-w-24 flex items-center justify-center gap-1.5"
          >
            RESET
          </button>
        </div>
      </form>
  );
}
