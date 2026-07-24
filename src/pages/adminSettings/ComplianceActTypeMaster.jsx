import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useShowBackButton } from '../../hooks/useShowBackButton';
import DataTable from '../../components/ui/DataTable';
import { getActTypeList, saveActType, deleteActType } from '../../services/adminService';

export default function ComplianceActTypeMaster() {
  const navigate = useNavigate();
  const showBack = useShowBackButton();
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState('');
  const [saving, setSaving]   = useState(false);
  const [formOpen, setFormOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getActTypeList();
      setData(res.data?.response || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!newType.trim()) {
      await Swal.fire({
        title: 'Please Enter Compliance Act Type To Save',
        icon: 'warning', timer: 5000, confirmButtonColor: '#42ba96',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await saveActType(newType.trim());
      const obj = res.data;
      if (obj.status_code === 200) {
        await Swal.fire({ title: obj.message, icon: 'success', timer: 2000, showConfirmButton: false });
        setNewType('');
        load();
      } else {
        await Swal.fire({ title: obj.message, icon: 'error', timer: 3000 });
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    const result = await Swal.fire({
      title: 'Are you sure?', text: 'You want to delete this Act Type!', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Delete it!',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await deleteActType(id);
      const obj = res.data;
      if (obj.status_code === 200) {
        Swal.fire({ title: obj.message, icon: 'success', timer: 1000, showConfirmButton: false });
        load();
      } else {
        Swal.fire({ title: obj.message, icon: 'warning', timer: 3000, showConfirmButton: false });
      }
    } catch { Swal.fire({ title: 'Error', icon: 'error' }); }
  }

  const columns = [
    { label: 'SR.NO', filterable: false, render: (_, i) => i + 1 },
    { key: 'complianceActType', label: 'COMPLIANCE ACT CATEGORY' },
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
          <h3>1. Add Compliance Act Category</h3>
          <i className={`fas ${formOpen ? 'fa-angle-double-down' : 'fa-angle-double-up'} text-xs`} />
        </div>
        <div className={`card-collapse-container ${formOpen ? 'open' : ''}`}>
          <div className="p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <label className="form-label mb-0 whitespace-nowrap">Enter Compliance Act Category <span className="text-red-500 font-bold">*</span></label>
              <div className="flex-1 max-w-xl">
                <input
                  id="comp_act_type"
                  className="form-input bg-white w-full"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="Enter compliance act category"
                />
              </div>
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
          <h3>2. Compliance Act Category Details</h3>
          <i className={`fas ${listOpen ? 'fa-angle-double-down' : 'fa-angle-double-up'} text-xs`} />
        </div>
        <div className={`card-collapse-container ${listOpen ? 'open' : ''}`}>
          <div className="p-4 md:p-5">
            <DataTable columns={columns} data={data} loading={loading} reportTitle="Compliance Act Category List" />
          </div>
        </div>
      </div>
    </div>
  );
}
