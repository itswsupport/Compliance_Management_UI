import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import AdminNavCards from '../../components/ui/AdminNavCards';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import SearchableSelect from '../../components/ui/SearchableSelect';
import {
  getActTypeList, getActSubTypeList, saveActSubType, deleteActSubType,
} from '../../services/adminService';
import { getFlowName } from '../../utils/formatters';

export default function ComplianceActSubTypeMaster() {
  const [data, setData]         = useState([]);
  const [actTypes, setActTypes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    complianceActType: '', complianceActSubType: '', approvalFlowStatus: '',
  });
  // The page opens on the list alone — the add form is revealed by the
  // "Add …" button in the list header.
  const [formOpen, setFormOpen] = useState(false);
  // Validation messages shown inline in the popup — no separate alert dialog.
  const [errors, setErrors] = useState({});

  // null = the popup is adding; an id = it is editing that row.
  const [editId, setEditId] = useState(null);

  const EMPTY_FORM = {
    complianceActType: '', complianceActSubType: '', approvalFlowStatus: '',
  };

  function openForm() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormOpen(true);
  }

  function openEdit(row) {
    setEditId(row.id);
    setForm({
      complianceActType: row.complianceActType || '',
      complianceActSubType: row.complianceActSubType || '',
      approvalFlowStatus: row.approvalFlowStatus || '',
    });
    setErrors({});
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => ({ ...e, [name]: '' }));
  }

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
    const e = {};
    if (!form.complianceActType)              e.complianceActType = 'Please select compliance category';
    if (!form.complianceActSubType.trim())    e.complianceActSubType = 'Please enter compliance subcategory';
    if (!form.approvalFlowStatus)             e.approvalFlowStatus = 'Please select approval flow';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // Compare ignoring case and extra spaces.
  const normalise = (s) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

  async function handleSave() {
    if (!validate()) return;
    // Duplicate = same category AND subcategory. Skip the row being edited.
    const clash = data.some(
      (r) => r.id !== editId
        && normalise(r.complianceActType) === normalise(form.complianceActType)
        && normalise(r.complianceActSubType) === normalise(form.complianceActSubType),
    );
    if (clash) {
      await Swal.fire({
        title: 'This Compliance Act Subcategory Already Exists',
        icon: 'warning',
        confirmButtonColor: '#3482AE',
      });
      return;
    }
    // Capture before closing — closeForm() resets the form.
    const { complianceActType, complianceActSubType, approvalFlowStatus } = form;
    const id = editId;
    // The popup goes away the moment Submit is accepted; the outcome is
    // reported by the dialog that follows.
    closeForm();

    setSaving(true);
    try {
      const res = await saveActSubType(
        complianceActType, complianceActSubType, approvalFlowStatus, id,
      );
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
      title = 'This Compliance Act Subcategory Already Exists';
    } else if (ok) {
      // The endpoint is shared by insert and update, so its message always reads
      // "Inserted Successfully" — say "Updated" ourselves when editing.
      title = isEdit ? 'Compliance Act Subcategory Updated Successfully' : (message || 'Saved Successfully');
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
    { label: 'SR.NO', filterable: false, width: 80, render: (_, i) => i + 1 },
    { key: 'complianceActType',    label: 'COMPLIANCE ACT CATEGORY' },
    { key: 'complianceActSubType', label: 'COMPLIANCE ACT SUBCATEGORY' },
    {
      label: 'APPROVAL FLOW', filterable: false,
      render: (row) => getFlowName(row.approvalFlowStatus),
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
        title={editId ? 'Edit Compliance Act Subcategory' : 'Add Compliance Act Subcategory'}
        size="md"
      >
      <div className="grid grid-cols-1 gap-4">
        <div className="form-group mb-0">
          <label className="form-label">Compliance Category <span className="text-red-500 font-bold">*</span></label>
          <SearchableSelect
            id="sel_comp_act_type_list"
            value={form.complianceActType}
            onChange={(v) => setField('complianceActType', v)}
            placeholder="Select Compliance Category"
            optionClassName="text-gray-800"
            options={actTypes.map((a) => ({
              value: a.complianceActType,
              label: a.complianceActType,
            }))}
          />
          {errors.complianceActType && <p className="form-error">{errors.complianceActType}</p>}
        </div>
        <div className="form-group mb-0">
          <label className="form-label">Compliance Subcategory <span className="text-red-500 font-bold">*</span></label>
          <input
            id="comp_act_desc"
            className="form-input bg-white"
            value={form.complianceActSubType}
            onChange={(e) => setField('complianceActSubType', e.target.value)}
            placeholder="Enter subcategory"
          />
          {errors.complianceActSubType && <p className="form-error">{errors.complianceActSubType}</p>}
        </div>
        <div className="form-group mb-0">
          <label className="form-label">Approval Flow <span className="text-red-500 font-bold">*</span></label>
          <SearchableSelect
            id="sel_comp_act_flow"
            value={form.approvalFlowStatus}
            onChange={(v) => setField('approvalFlowStatus', v)}
            placeholder="Select Flow"
            searchable={false}
            optionClassName="text-gray-800"
            options={[
              { value: 'PHR', label: 'Plant HR' },
              { value: 'CA', label: 'Compliance Admin' },
            ]}
          />
          {errors.approvalFlowStatus && <p className="form-error">{errors.approvalFlowStatus}</p>}
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

      {/* List table */}
      <div className="card">
        <div className="custom-card-header flex items-center justify-between select-none no-print">
          <h3>Compliance Act Subcategory Details</h3>
          <button
            onClick={openForm}
            className="add-record-btn"
            title="Add Compliance Act Subcategory"
          >
            <i className="fas fa-plus" /> Add
          </button>
        </div>
        <div className="p-4 md:p-5">
          <DataTable columns={columns} data={data} loading={loading} reportTitle="Compliance Act Subcategory List" />
        </div>
      </div>
    </div>
  );
}
