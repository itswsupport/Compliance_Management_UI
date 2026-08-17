import api, { NO_TIMEOUT } from './api';

/* ── Compliance Act Type ── */

export const getActTypeList = () => api.get('act_type/list', NO_TIMEOUT);

// Pass `id` to edit an existing row: the endpoint binds the whole entity and
// hands it to repository.save(), so a present id updates instead of inserting.
export const saveActType = (complianceActType, id) =>
  api.post('act_type/save', null, {
    params: id ? { id, complianceActType } : { complianceActType },
  });

export const deleteActType = (id) =>
  api.delete('act_type/delete', { params: { id } });

/* ── Compliance Act Sub Type ── */

export const getActSubTypeList = () => api.get('act_desc/list', NO_TIMEOUT);

export const getActSubTypeByActType = (complianceActType) =>
  api.get('act_sub_type/by_act_type', { params: { complianceActType } });

// `id` present → update (see saveActType).
export const saveActSubType = (complianceActType, complianceActSubType, approvalFlowStatus, id) =>
  api.post('act_desc/save', null, {
    params: id
      ? { id, complianceActType, complianceActSubType, approvalFlowStatus }
      : { complianceActType, complianceActSubType, approvalFlowStatus },
  });

export const deleteActSubType = (id) =>
  api.delete('act_desc/delete', { params: { id } });

/* ── Login Access ── */

export const getLoginAccessList = () => api.get('login/access/list', NO_TIMEOUT);

// `id` present → update. Note the endpoint still rejects a duplicate
// empCode+roleId pair, so saving an edit that changes nothing is refused.
export const saveLoginAccess = (empCode, roleId, id) =>
  api.post('login/save', null, {
    params: id ? { id, empCode, roleId } : { empCode, roleId },
  });

export const deleteLoginAccess = (id) =>
  api.delete('delete/login', { params: { id } });

/* ── Employees ── */

export const getEmployeeList = () => api.get('employee/list', NO_TIMEOUT);
