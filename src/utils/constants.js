const ROLES = {
  DOCTOR      : 'doctor',
  PHARMACIE   : 'pharmacie',
  LABORATOIRE : 'laboratoire',
  PATIENT     : 'patient',
  ADMIN       : 'admin',
};

const PRO_ROLES = [ROLES.DOCTOR, ROLES.PHARMACIE, ROLES.LABORATOIRE];

module.exports = { ROLES, PRO_ROLES };
