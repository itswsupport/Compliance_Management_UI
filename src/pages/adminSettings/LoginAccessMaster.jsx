import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import AdminNavCards from '../../components/ui/AdminNavCards';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import SearchableSelect from '../../components/ui/SearchableSelect';
import {
  getLoginAccessList, saveLoginAccess, deleteLoginAccess, getEmployeeList,
} from '../../services/adminService';
import { ROLE_NAMES, ROLES } from '../../utils/constants';

export default function LoginAccessMaster() {
  const [data, setData]         = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({ empCode: '', roleId: '' });
  // The page opens on the list alone — the add form is revealed by the
  // "Add …" button in the list header.
  const [formOpen, setFormOpen] = useState(false);
  // Validation messages shown inline in the popup — no separate alert dialog.
  const [errors, setErrors] = useState({});

  // null = the popup is adding; an id = it is editing that row.
  const [editId, setEditId] = useState(null);

  function openForm() {
    setEditId(null);
    setForm({ empCode: '', roleId: '' });
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm({
      empCode: row.empCode != null ? String(row.empCode) : '',
      roleId: row.roleId != null ? String(row.roleId) : '',
    });
    setErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
    setForm({ empCode: '', roleId: '' });
    setErrors({});
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: '' }));
  }

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
    const e = {};
    if (!form.empCode || form.empCode === '0') e.empCode = 'Please select employee name';
    if (!form.roleId || form.roleId === '0')   e.roleId = 'Please select role';
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    // Capture before closing — closeForm() resets the form.
    const { empCode, roleId } = form;
    const id = editId;

    // Same employee + role already in the list, ignoring the row being edited.
    // Checked here rather than left to the server: it reports this case as a
    // generic SERVER ERROR, which tells the user nothing.
    const duplicate = data.some((r) =>
      String(r.empCode) === String(empCode) &&
      String(r.roleId) === String(roleId) &&
      String(r.id) !== String(id ?? ''));

    // The popup goes away the moment Submit is accepted; the outcome is
    // reported by the dialog that follows.
    closeForm();

    if (duplicate) {
      await Swal.fire({
        title: 'Access Has Already Been Given To This Employee',
        icon: 'warning',
        confirmButtonColor: '#3482AE',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await saveLoginAccess(empCode, roleId, id);
      const obj = JSON.parse(typeof res.data === 'string' ? res.data : JSON.stringify(res.data));
      await reportSave(obj.status_code === 200, obj.message, id);
    } catch (err) {
      // The server can answer a rejection with a non-2xx status, which axios
      // throws. Its body still carries the reason — show that, never a raw error.
      await reportSave(false, err?.response?.data?.message, id);
    } finally {
      setSaving(false);
      load();
    }
  }

  // The backend rejects an employee who already holds that role with
  // "User login already exists" — say it plainly instead.
  async function reportSave(ok, message, isEdit) {
    const duplicate = /already\s*exist/i.test(message || '');
    let title;
    if (duplicate) {
      title = 'Access Has Already Been Given To This Employee';
    } else if (ok) {
      // The endpoint is shared by insert and update, so its message always reads
      // "Inserted Successfully" — say "Updated" ourselves when editing.
      title = isEdit ? 'Login Access Updated Successfully' : (message || 'Saved Successfully');
    } else {
      title = message || 'Could not save. Please try again.';
    }
    await Swal.fire({
      title,
      icon: ok ? 'success' : 'warning',
      timer: ok ? 1500 : 3000,
      showConfirmButton: false,
    });
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
    { label: 'SR.NO', filterable: false, width: 80, render: (_, i) => i + 1 },
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
      label: 'ACTION', filterable: false, width: 160,
      render: (row) => (
        <div className="flex items-center justify-center gap-4 w-full h-full">
          <button onClick={() => openEdit(row)} className="btn-primary btn-sm btn" style={{ padding: '4px 8px' }} title="Edit">
            <i className="fas fa-pen" />
          </button>
          <button onClick={() => handleDelete(row.id)} className="btn-danger btn-sm btn" style={{ padding: '4px 8px' }} title="Delete">
            <i className="fas fa-trash" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <h1 className="section-title no-print">
        Admin Settings
      </h1>

      <AdminNavCards />

      {/* Add / Edit form — popup opened by "Add …" in the list header, or by
          the Edit action on a row. */}
      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editId ? 'Edit Login Access' : 'Add Login Access'}
        size="md"
      >
      <div className="grid grid-cols-1 gap-4">
        <div className="form-group mb-0">
          <label className="form-label">Employee <span className="text-red-500 font-bold">*</span></label>
          <SearchableSelect
            id="sel_employee"
            value={form.empCode}
            onChange={(v) => setField('empCode', v)}
            placeholder="Select Employee"
            optionClassName="text-gray-800"
            options={employees.map((emp) => {
              // Array shape: [fname, lname, empCode]
              const [code, name] = Array.isArray(emp)
                ? [emp[2], `${emp[0] || ''} ${emp[1] || ''}`]
                : [emp.employeeCode, `${emp.employeeFname || ''} ${emp.employeeLname || ''}`];
              // Code goes in the label too — the dropdown filters on label,
              // so employees become searchable by code as well as by name.
              return {
                value: code,
                label: code ? `${name.trim()} (${code})` : name.trim(),
              };
            })}
          />
          {errors.empCode && <p className="form-error">{errors.empCode}</p>}
        </div>

        <div className="form-group mb-0">
          <label className="form-label">Role <span className="text-red-500 font-bold">*</span></label>
          <SearchableSelect
            id="sel_role"
            value={form.roleId}
            onChange={(v) => setField('roleId', v)}
            placeholder="Select Role"
            optionClassName="text-gray-800"
            options={Object.entries(ROLES).map(([name, id]) => ({
              value: id,
              label: ROLE_NAMES[id],
            }))}
          />
          {errors.roleId && <p className="form-error">{errors.roleId}</p>}
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
      </Modal>

      {/* List */}
      <div className="card">
        <div className="custom-card-header flex items-center justify-between select-none no-print">
          <h3>Login Access Details</h3>
          <button
            onClick={openForm}
            className="add-record-btn"
            title="Add Login Access"
          >
            <i className="fas fa-plus" /> Add
          </button>
        </div>
        <div className="p-4 md:p-5">
          <DataTable columns={columns} data={data} loading={loading} reportTitle="Login Access List" />
        </div>
      </div>
    </div>
  );
}
