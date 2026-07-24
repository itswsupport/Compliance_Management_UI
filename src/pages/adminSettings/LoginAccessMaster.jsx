import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useShowBackButton } from '../../hooks/useShowBackButton';
import DataTable from '../../components/ui/DataTable';
import SearchableSelect from '../../components/ui/SearchableSelect';
import {
  getLoginAccessList, saveLoginAccess, deleteLoginAccess, getEmployeeList,
} from '../../services/adminService';
import { ROLE_NAMES, ROLES } from '../../utils/constants';

export default function LoginAccessMaster() {
  const navigate = useNavigate();
  const showBack = useShowBackButton();
  const [data, setData]         = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ empCode: '', roleId: '' });
  const [formOpen, setFormOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lRes, eRes] = await Promise.all([getLoginAccessList(), getEmployeeList()]);
      setData(lRes.data?.response || lRes.data?.data || []);
      setEmployees(eRes.data?.response || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    // Alert only the first missing field, employee before role.
    let missing = '';
    if (!form.empCode || form.empCode === '0')     missing = 'Select Employee Name';
    else if (!form.roleId || form.roleId === '0')  missing = 'Select Role';
    if (missing) {
      await Swal.fire({
        title: missing,
        icon: 'warning', timer: 5000, confirmButtonColor: '#42ba96',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await saveLoginAccess(form.empCode, form.roleId);
      const obj = JSON.parse(typeof res.data === 'string' ? res.data : JSON.stringify(res.data));
      if (obj.status_code === 200) {
        await Swal.fire({ title: obj.message, icon: 'success', timer: 1000, showConfirmButton: false });
        setForm({ empCode: '', roleId: '' });
        load();
      } else {
        await Swal.fire({ title: obj.message, icon: 'warning', timer: 5000 });
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    const result = await Swal.fire({
      title: 'Are you sure?', text: 'You want to delete this file!', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Delete it!',
    });
    if (!result.isConfirmed) return;
    const res = await deleteLoginAccess(id);
    const obj = res.data;
    if (obj.status_code === 200) {
      Swal.fire({ title: obj.message, icon: 'success', timer: 1000, showConfirmButton: false });
      load();
    } else {
      Swal.fire({ title: obj.message, icon: 'warning', timer: 5000, showConfirmButton: false });
    }
  }

  const columns = [
    { label: 'SR.NO', filterable: false, render: (_, i) => i + 1 },
    { key: 'empCode', label: 'EMPLOYEE CODE' },
    {
      label: 'EMPLOYEE NAME', filterable: false,
      render: (row) => {
        if (row.empName) return row.empName;
        if (row.employeeName) return row.employeeName;
        const u = row.user;
        if (!u) return '';
        if (Array.isArray(u)) {
          return `${u[0] || ''} ${u[1] || ''}`.trim();
        }
        return `${u.employeeFname || u.userFname || ''} ${u.employeeLname || u.userLname || ''}`.trim();
      },
    },
    { key: 'plantCode', label: 'PLANT CODE' },
    {
      label: 'ROLE', filterable: false,
      render: (row) => ROLE_NAMES[row.roleId] || String(row.roleId),
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
          <h3>1. Add Login Access</h3>
          <i className={`fas ${formOpen ? 'fa-angle-double-down' : 'fa-angle-double-up'} text-xs`} />
        </div>
        <div className={`card-collapse-container ${formOpen ? 'open' : ''}`}>
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
              <div className="form-group mb-0">
                <label className="form-label">Employee <span className="text-red-500 font-bold">*</span></label>
                <SearchableSelect
                  id="sel_employee"
                  value={form.empCode}
                  onChange={(v) => setForm((f) => ({ ...f, empCode: v }))}
                  placeholder="Select Employee"
                  optionClassName="text-gray-800"
                  options={employees.map((emp, i) => {
                    if (Array.isArray(emp)) {
                      return { value: emp[2], label: `${emp[0]} ${emp[1]}` };
                    }
                    return {
                      value: emp.employeeCode,
                      label: `${emp.employeeFname} ${emp.employeeLname}`,
                    };
                  })}
                />
              </div>

              <div className="form-group mb-0">
                <label className="form-label">Role <span className="text-red-500 font-bold">*</span></label>
                <SearchableSelect
                  id="sel_role"
                  value={form.roleId}
                  onChange={(v) => setForm((f) => ({ ...f, roleId: v }))}
                  placeholder="Select Role"
                  optionClassName="text-gray-800"
                  options={Object.entries(ROLES).map(([name, id]) => ({
                    value: id,
                    label: ROLE_NAMES[id],
                  }))}
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

      {/* List */}
      <div className="card">
        <div
          className="custom-card-header flex items-center justify-between cursor-pointer select-none no-print"
          onClick={() => setListOpen(!listOpen)}
        >
          <h3>2. Login Access Details</h3>
          <i className={`fas ${listOpen ? 'fa-angle-double-down' : 'fa-angle-double-up'} text-xs`} />
        </div>
        <div className={`card-collapse-container ${listOpen ? 'open' : ''}`}>
          <div className="p-4 md:p-5">
            <DataTable columns={columns} data={data} loading={loading} reportTitle="Login Access List" />
          </div>
        </div>
      </div>
    </div>
  );
}
