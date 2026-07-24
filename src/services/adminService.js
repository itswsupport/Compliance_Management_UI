import api from './api';

/* ── Compliance Act Type ── */

export const getActTypeList = () => api.get('act_type/list');

export const saveActType = (complianceActType) =>
  api.post('act_type/save', null, { params: { complianceActType } });

export const deleteActType = (id) =>
  api.delete('act_type/delete', { params: { id } });

/* ── Compliance Act Sub Type ── */

export const getActSubTypeList = () => api.get('act_desc/list');

export const getActSubTypeByActType = (complianceActType) =>
  api.get('act_sub_type/by_act_type', { params: { complianceActType } });

export const saveActSubType = (complianceActType, complianceActSubType, approvalFlowStatus) =>
  api.post('act_desc/save', null, {
    params: { complianceActType, complianceActSubType, approvalFlowStatus },
  });

export const deleteActSubType = (id) =>
  api.delete('act_desc/delete', { params: { id } });

/* ── Login Access ── */

export const getLoginAccessList = () => api.get('login/access/list');

export const saveLoginAccess = (empCode, roleId) =>
  api.post('login/save', null, { params: { empCode, roleId } });

export const deleteLoginAccess = (id) =>
  api.delete('delete/login', { params: { id } });

/* ── Employees ── */

export const getEmployeeList = () => api.get('employee/list');
