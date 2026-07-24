import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import { useShowBackButton } from '../../hooks/useShowBackButton';
import SearchableSelect from '../../components/ui/SearchableSelect';
import {
  getPlantList, saveCompliance, getComplianceFlowStatus,
} from '../../services/complianceService';
import {
  getActTypeList, getActSubTypeByActType,
} from '../../services/adminService';
import { todayDate, currentTime } from '../../utils/formatters';
import { LS_KEYS, FREQUENCY_OPTIONS } from '../../utils/constants';

const NAV_CARDS = [
  { label: 'Assign Compliance',  icon: 'fas fa-plus',         color: 'bg-c-info',    to: '/comp-admin/assign' },
  { label: 'Pending Compliance', icon: 'fas fa-spinner',       color: 'bg-c-pending', to: '/comp-admin/pending' },
  { label: 'Approved Compliance',icon: 'fas fa-check-square',  color: 'bg-c-green1',  to: '/comp-admin/approved' },
  { label: 'Overdue Compliance', icon: 'far fa-hourglass',     color: 'bg-c-draft',   to: '/comp-admin/overdue' },
];

export default function AssignCompliance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const showBack = useShowBackButton();

  const [plants, setPlants]       = useState([]);
  const [actTypes, setActTypes]   = useState([]);
  const [subTypes, setSubTypes]   = useState([]);
  const [saving, setSaving]       = useState(false);
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
  });

  useEffect(() => {
    Promise.all([getPlantList(), getActTypeList()]).then(([pRes, aRes]) => {
      setPlants(pRes.data?.response || []);
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

  async function handleSubTypeChange(val) {
    setForm((f) => ({ ...f, compActSubType: val }));
    if (!form.compActType || !val) return;
    const res = await getComplianceFlowStatus(form.compActType, val);
    setForm((f) => ({ ...f, approvalFlowStatus: res.data?.response?.approvalFlowStatus || '' }));
  }

  function validate() {
    const e = {};
    if (!form.plant)          e.plant = 'PLEASE SELECT PLANT';
    if (!form.compActType)    e.compActType = 'PLEASE SELECT COMPLIANCE CATEGORY';
    if (!form.compActSubType) e.compActSubType = 'PLEASE SELECT COMPLIANCE SUBCATEGORY';
    if (!form.compFrequency)  e.compFrequency = 'PLEASE SELECT FREQUENCY';
    if (form.compFrequency === 'AS & WHEN') {
      if (!form.startDate) e.startDate = 'PLEASE SELECT START DATE';
      if (!form.endDate)   e.endDate = 'PLEASE SELECT END DATE';
    } else {
      if (!form.firstDueDate) e.firstDueDate = 'PLEASE SELECT DUE DATE';
    }
    if (!form.attachment) e.attachment = 'PLEASE SELECT FILE ATTACHMENT';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const regDate = todayDate();
    const regTime = currentTime();
    const dateString = form.compFrequency === 'AS & WHEN' ? form.startDate : form.firstDueDate;
    const applicableYear = dateString ? dateString.split('-')[0] : '';

    const fd = new FormData();
    fd.append('plant', form.plant);
    fd.append('plantCode', form.plantCode);
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

    setSaving(true);
    try {
      const res = await saveCompliance(fd);
      const obj = res.data;
      if (obj.status_code === 200) {
        let displayMessage = obj.message || 'Compliance Act Request Sent Succesfully.';
        if (displayMessage === displayMessage.toUpperCase()) {
          displayMessage = displayMessage.toLowerCase().replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
        }
        await Swal.fire({ title: displayMessage, icon: 'success', timer: 2000, showConfirmButton: false });
        navigate('/comp-admin/pending');
      } else {
        let displayMessage = obj.message || '';
        if (displayMessage === displayMessage.toUpperCase()) {
          displayMessage = displayMessage.toLowerCase().replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
        }
        await Swal.fire({ title: displayMessage, icon: 'warning', timer: 2000, confirmButtonColor: '#42ba96' });
        navigate('/comp-admin/assign');
      }
    } catch {
      await Swal.fire({ title: 'An error occurred while saving the compliance', icon: 'error', confirmButtonColor: '#42ba96' });
    } finally {
      setSaving(false);
    }
  }

  const isAsWhen = form.compFrequency === 'AS & WHEN';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="section-title">
          COMPLIANCE ADMIN DASHBOARD
        </h1>
        {showBack && (
          <button onClick={() => navigate(-1)} className="back-button">
            <i className="fas fa-chevron-left" /> Back
          </button>
        )}
      </div>

      {/* Nav cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {NAV_CARDS.map((card) => (
          <div key={card.label} onClick={() => navigate(card.to)} className={`stat-card ${card.color}`}>
            <i className={`${card.icon} icon`} />
            <h5>{card.label}</h5>
          </div>
        ))}
      </div>

      {/* Form card */}
      <div className="card">
        <div className="card-header-info">
          <h3>
            <i className="fas fa-tasks" /> Assign Compliance
          </h3>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-3">

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
                  options={plants.map((p) => ({
                    value: String(p.id),
                    label: `${p.plantName} - ${p.plantCode}`,
                  }))}
                />
                {errors.plant && <p className="text-red-500 text-[10px] mt-1">{errors.plant}</p>}
              </div>

              {/* COMPLIANCE CATEGORY */}
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

              {/* COMPLIANCE SUBCATEGORY */}
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

              {/* FREQUENCY */}
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

              {/* Conditional Date fields */}
              {form.compFrequency && (
                <>
                  {isAsWhen ? (
                    <>
                      <div className="form-group relative">
                        <label className="form-label">START DATE</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="form-input w-full bg-white cursor-pointer"
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
                        </div>
                        {errors.startDate && <p className="text-red-500 text-[10px] mt-1">{errors.startDate}</p>}
                      </div>
                      <div className="form-group relative">
                        <label className="form-label">END DATE</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="form-input w-full bg-white cursor-pointer"
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
                          className="form-input w-full bg-white cursor-pointer"
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
                      </div>
                      {errors.firstDueDate && <p className="text-red-500 text-[10px] mt-1">{errors.firstDueDate}</p>}
                    </div>
                  )}
                </>
              )}

              {/* ATTACHMENT - Updated to plain text */}
              <div className="form-group">
                <label className="form-label">
                  ATTACHMENT <span className="text-[#FF0000] ml-0.5 text-[11px] font-normal">(COMPLIANCE ACT/NOTIFICATION DOCUMENT.)</span>
                </label>
                <input
                  type="file"
                  className="form-input w-full bg-white"
                  onChange={(e) => setForm((f) => ({ ...f, attachment: e.target.files[0] || null }))}
                />
                {errors.attachment && <p className="text-red-500 text-[10px] mt-1">{errors.attachment}</p>}
              </div>

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
                <><span className="loading-spinner" /> Processing…</>
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