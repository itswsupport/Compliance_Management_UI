import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useShowBackButton } from '../../hooks/useShowBackButton';
import DataTable from '../../components/ui/DataTable';
import SearchableSelect from '../../components/ui/SearchableSelect';
import {
  getActTypeList, getActSubTypeList, saveActSubType, deleteActSubType,
} from '../../services/adminService';
import { getFlowName } from '../../utils/formatters';

export default function ComplianceActSubTypeMaster() {
  const navigate = useNavigate();
  const showBack = useShowBackButton();
  const [data, setData]         = useState([]);
  const [actTypes, setActTypes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    complianceActType: '', complianceActSubType: '', approvalFlowStatus: '',
  });
  const [formOpen, setFormOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([getActSubTypeList(), getActTypeList()]);
      setData(sRes.data?.response || []);
      setActTypes(aRes.data?.response || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function validate() {
    return Boolean(form.complianceActType && form.complianceActSubType && form.approvalFlowStatus);
  }

  async function handleSave() {
    if (!validate()) {
      await Swal.fire({
        title: 'Please Fill Above Fields To Save Details',
        icon: 'warning', timer: 5000, confirmButtonColor: '#42ba96',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await saveActSubType(form.complianceActType, form.complianceActSubType, form.approvalFlowStatus);
      const obj = res.data;
      if (obj.status_code === 200) {
        await Swal.fire({ title: obj.message, icon: 'success', timer: 2000, showConfirmButton: false });
        setForm({ complianceActType: '', complianceActSubType: '', approvalFlowStatus: '' });
        load();
      } else {
        await Swal.fire({ title: obj.message, icon: 'error', timer: 3000 });
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    const result = await Swal.fire({
      title: 'Are you sure?', text: 'You want to delete this Act Sub Type!', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Delete it!',
    });
    if (!result.isConfirmed) return;
    const res = await deleteActSubType(id);
    const obj = res.data;
    if (obj.status_code === 200) {
      Swal.fire({ title: obj.message, icon: 'success', timer: 1000, showConfirmButton: false });
      load();
    } else {
      Swal.fire({ title: obj.message, icon: 'warning', timer: 3000, showConfirmButton: false });
    }
  }

  const columns = [
    { label: 'SR.NO', filterable: false, render: (_, i) => i + 1 },
    { key: 'complianceActType',    label: 'COMPLIANCE ACT CATEGORY' },
    { key: 'complianceActSubType', label: 'COMPLIANCE ACT SUBCATEGORY' },
    {
      label: 'APPROVAL FLOW', filterable: false,
      render: (row) => getFlowName(row.approvalFlowStatus),
    },
    {
      label: 'ACTION', filterable: false,
      render: (row) => (
        <button onClick={() => handleDelete(row.id)} className="btn-danger btn-sm btn" style={{ padding: '4px 8px' }}>
          <i className="fas fa-trash" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between no-print">
        <h1 className="section-title">
          Admin Settings
        </h1>
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="back-button"
          >
            <i className="fas fa-chevron-left" /> Back
          </button>
        )}
      </div>

      {/* Large Navigation Tab Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none no-print">
        <button
          onClick={() => navigate('/admin/act-type')}
          className="nav-card-btn"
        >
          <i className="fas fa-plus fa-lg text-white" />
          <span>Add Compliance Act Category</span>
        </button>
        <button
          onClick={() => navigate('/admin/act-sub-type')}
          className="nav-card-btn"
        >
          <i className="fas fa-plus fa-lg text-white" />
          <span>Add Compliance Act Subcategory</span>
        </button>
        <button
          onClick={() => navigate('/admin/login-access')}
          className="nav-card-btn"
        >
          <i className="fas fa-plus fa-lg text-white" />
          <span>Add Login Access</span>
        </button>
      </div>

      {/* Add form */}
      <div className="card no-print">
        <div 
          className="custom-card-header flex items-center justify-between cursor-pointer select-none"
          onClick={() => setFormOpen(!formOpen)}
        >
          <h3>1. Add Compliance Act Subcategory</h3>
          <i className={`fas ${formOpen ? 'fa-angle-double-down' : 'fa-angle-double-up'} text-xs`} />
        </div>
        <div className={`card-collapse-container ${formOpen ? 'open' : ''}`}>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
              <div className="form-group mb-0">
                <label className="form-label">Compliance Category <span className="text-red-500 font-bold">*</span></label>
                <SearchableSelect
                  id="sel_comp_act_type_list"
                  value={form.complianceActType}
                  onChange={(v) => setForm((f) => ({ ...f, complianceActType: v }))}
                  placeholder="Select Compliance Category"
                  optionClassName="text-gray-800"
                  options={actTypes.map((a) => ({
                    value: a.complianceActType,
                    label: a.complianceActType,
                  }))}
                />
              </div>
              <div className="form-group mb-0">
                <label className="form-label">Compliance Subcategory <span className="text-red-500 font-bold">*</span></label>
                <input
                  id="comp_act_desc"
                  className="form-input bg-white"
                  value={form.complianceActSubType}
                  onChange={(e) => setForm((f) => ({ ...f, complianceActSubType: e.target.value }))}
                  placeholder="Enter subcategory"
                />
              </div>
              <div className="form-group mb-0">
                <label className="form-label">Approval Flow <span className="text-red-500 font-bold">*</span></label>
                <SearchableSelect
                  id="sel_comp_act_flow"
                  value={form.approvalFlowStatus}
                  onChange={(v) => setForm((f) => ({ ...f, approvalFlowStatus: v }))}
                  placeholder="Select Flow"
                  searchable={false}
                  optionClassName="text-gray-800"
                  options={[
                    { value: 'PHR', label: 'Plant HR' },
                    { value: 'CA', label: 'Compliance Admin' },
                  ]}
                />
              </div>
            </div>
            <div className="flex justify-center mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn text-white bg-[#3482AE] hover:bg-[#2A6B91] px-5 py-1.5 rounded uppercase font-bold text-xs border-0 cursor-pointer flex items-center justify-center gap-1.5 min-w-24"
              >
                {saving ? (
                  <><span className="loading-spinner" /> Saving…</>
                ) : (
                  <><i className="fa fa-save" /> Submit</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* List table */}
      <div className="card">
        <div
          className="custom-card-header flex items-center justify-between cursor-pointer select-none no-print"
          onClick={() => setListOpen(!listOpen)}
        >
          <h3>2. Compliance Act Subcategory Details</h3>
          <i className={`fas ${listOpen ? 'fa-angle-double-down' : 'fa-angle-double-up'} text-xs`} />
        </div>
        <div className={`card-collapse-container ${listOpen ? 'open' : ''}`}>
          <div className="p-4 md:p-5">
            <DataTable columns={columns} data={data} loading={loading} reportTitle="Compliance Act Subcategory List" />
          </div>
        </div>
      </div>
    </div>
  );
}
