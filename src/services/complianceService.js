import api, { NO_TIMEOUT } from './api';
import { LS_KEYS } from '../utils/constants';

/**
 * Get compliance list by status array
 * GET /compliance/pending/list?regBy=&status[]=
 */
export const getComplianceList = (empCode, statusArray) => {
  const params = new URLSearchParams();
  params.append('regBy', empCode);
  if (Array.isArray(statusArray)) {
    statusArray.forEach((s) => params.append('status[]', s));
  }
  return api.get(`compliance/pending/list?${params.toString()}`, NO_TIMEOUT);
};

/**
 * Get Plant HR compliance list
 * GET /phr/compliance/list
 */
export const getPhrComplianceList = (mstStatus, empCode, level, statusArray) => {
  const params = new URLSearchParams();
  params.append('mstStatus', mstStatus);
  params.append('empCode', empCode);
  params.append('level', level);
  if (Array.isArray(statusArray)) {
    statusArray.forEach((s) => params.append('status[]', s));
  }
  return api.get(`phr/compliance/list?${params.toString()}`, NO_TIMEOUT);
};

/**
 * Get user compliance list
 * GET /user/compliance/list
 */
export const getUserComplianceList = (empCode, level, statusArray) => {
  const params = new URLSearchParams();
  params.append('empCode', empCode);
  params.append('level', level);
  if (Array.isArray(statusArray)) {
    statusArray.forEach((s) => params.append('status[]', s));
  }
  return api.get(`user/compliance/list?${params.toString()}`, NO_TIMEOUT);
};

/**
 * Get authority compliance list
 * GET /authority/compliance/list
 */
export const getAuthorityComplianceList = (statusArray) => {
  const params = new URLSearchParams();
  if (Array.isArray(statusArray)) {
    statusArray.forEach((s) => params.append('status[]', s));
  }
  return api.get(`authority/compliance/list?${params.toString()}`, NO_TIMEOUT);
};

/**
 * Get compliance details by ID
 * GET /compliance/details/by_id?id=
 */
export const getComplianceById = (id) =>
  api.get('compliance/details/by_id', { params: { id } });

/**
 * Save (assign) new compliance
 * POST /compliance/save (multipart/form-data)
 */
export const saveCompliance = (formData) =>
  api.post('compliance/save', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/**
 * Delete compliance entry
 * DELETE /compliance/delete?id=
 */
export const deleteCompliance = (id) =>
  api.delete('compliance/delete', { params: { id } });

/**
 * Get compliance serial number
 * GET /compliance/comp_sr_no
 */
export const getCompSrNo = () =>
  api.get('compliance/comp_sr_no');

/**
 * Get flow status by act type + sub type
 * GET /compliance/by_act_type_and_act_sub_type?compActType=&compActSubType=
 */
export const getComplianceFlowStatus = (compActType, compActSubType) =>
  api.get('compliance/by_act_type_and_act_sub_type', {
    params: { compActType, compActSubType },
  });

/**
 * Get action history for a compliance record
 * GET /compliance_action/list?mstId=
 */
export const getActionHistory = (mstId) =>
  api.get('compliance_action/list', { params: { mstId } });

/**
 * Save compliance action (submit/approve/reject)
 * POST /compliance_action/save (multipart/form-data)
 */
// export const saveComplianceAction = (formData) =>
//   api.post('compliance_action/save', formData, {
//     headers: { 'Content-Type': 'multipart/form-data' },
//   });
/**
 * Save compliance action (submit/approve/reject)
 * POST /compliance_action/save (multipart/form-data)
 */
export const saveComplianceAction = (formData) => {
  // Ensure required parameters for backend
  const empCode = localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE);
  if (empCode) {
    formData.append('emp_code', empCode);
    formData.append('authEmpCode', empCode);
  }
  
  return api.post('compliance_action/save', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

/**
 * Download file
 * GET /download/file?id=&file_name=
 */
export const getDownloadUrl = (id, fileName) =>
  `${api.defaults.baseURL}download/file?id=${id}&file_name=${fileName}`;

/**
 * Get plant list
 * GET /plant/list
 */
export const getPlantList = () => api.get('plant/list');

/**
 * Get department list
 * GET /department/list
 */
export const getDepartmentList = () => api.get('department/list');

/**
 * Get responsible person by plant + department
 * GET /responsible_person/by_plant_id_and_dept?dept_id=&plant_id=
 */
export const getResponsiblePersons = (deptId, plantId) =>
  api.get('responsible_person/by_plant_id_and_dept', {
    params: { dept_id: deptId, plant_id: plantId },
  });
