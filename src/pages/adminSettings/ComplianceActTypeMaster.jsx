import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import AdminNavCards from '../../components/ui/AdminNavCards';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { getActTypeList, saveActType, deleteActType } from '../../services/adminService';

export default function ComplianceActTypeMaster() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState('');
  const [saving, setSaving]   = useState(false);
  // The page opens on the list alone — the add form is revealed by the
  // "Add …" button in the list header.
  const [formOpen, setFormOpen] = useState(false);
  // Validation message shown inline in the popup — no separate alert dialog.
  const [error, setError] = useState('');
  // null = the popup is adding; an id = it is editing that row.
  const [editId, setEditId] = useState(null);

  function openForm() {
    setEditId(null);
    setNewType('');
    setError('');
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setNewType(row.complianceActType || '');
    setError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
    setNewType('');
    setError('');
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getActTypeList();
      setData(res.data?.response || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compare ignoring case and extra spaces.
  const normalise = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

  async function handleSave() {
    if (!newType.trim()) {
      setError('Please enter compliance act category to save');
      return;
    }
    // The server allows duplicates, so block them here. Skip the row being edited.
    const clash = data.some(
      (r) => r.id !== editId && normalise(r.complianceActType) === normalise(newType),
    );
    if (clash) {
      await Swal.fire({
        title: 'This Compliance Act Category Already Exists',
        // text: 'Please enter a different category.',
        icon: 'warning',
        confirmButtonColor: '#3482AE',
      });
      return;
    }
    // Capture before closing — closeForm() resets both.
    const value = newType.trim();
    const id = editId;
    // The popup goes away the moment Submit is accepted; the outcome is
    // reported by the dialog that follows.
    closeForm();

    setSaving(true);
    try {
      const res = await saveActType(value, id);
      const obj = res.data;
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

  async function reportSave(ok, message, isEdit) {
    const duplicate = /already\s*exist/i.test(message || '');
    let title;
    if (duplicate) {
      title = 'This Compliance Act Category Already Exists';
    } else if (ok) {
      // The endpoint is shared by insert and update, so its message always reads
      // "Inserted Successfully" — say "Updated" ourselves when editing.
      title = isEdit ? 'Compliance Act Category Updated Successfully' : (message || 'Saved Successfully');
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
    { label: 'SR.NO', filterable: false, width: 80, render: (_, i) => i + 1 },
    { key: 'complianceActType', label: 'COMPLIANCE ACT CATEGORY' },
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
        title={editId ? 'Edit Compliance Act Category' : 'Add Compliance Act Category'}
        size="md"
      >
        <div className="form-group mb-0">
          <label className="form-label">Enter Compliance Act Category <span className="text-red-500 font-bold">*</span></label>
          <input
            id="comp_act_type"
            className="form-input bg-white w-full"
            value={newType}
            onChange={(e) => { setNewType(e.target.value); setError(''); }}
            placeholder="Enter compliance act category"
          />
          {error && <p className="form-error">{error}</p>}
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

      {/* List table */}
      <div className="card">
        <div className="custom-card-header flex items-center justify-between select-none no-print">
          <h3>Compliance Act Category Details</h3>
          <button
            onClick={openForm}
            className="add-record-btn"
            title="Add Compliance Act Category"
          >
            <i className="fas fa-plus" /> Add
          </button>
        </div>
        <div className="p-4 md:p-5">
          <DataTable columns={columns} data={data} loading={loading} reportTitle="Compliance Act Category List" />
        </div>
      </div>
    </div>
  );
}
