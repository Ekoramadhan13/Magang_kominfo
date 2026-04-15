const moment = require('moment');
moment.locale('id');

const helpers = {
  formatDate: (date, format = 'DD MMMM YYYY') => {
    if (!date) return '-';
    return moment(date).format(format);
  },
  formatDateTime: (date) => {
    if (!date) return '-';
    return moment(date).format('DD MMM YYYY, HH:mm');
  },
  timeAgo: (date) => {
    if (!date) return '-';
    return moment(date).fromNow();
  },
  severityColor: (s) => ({ critical:'danger', major:'warning', minor:'info', trivial:'secondary' })[s] || 'secondary',
  statusColor: (s) => ({ open:'info', in_progress:'info', fixed:'info', verified:'success', closed:'warning', rejected:'danger' })[s] || 'secondary',
  bugStatusLabel: (s) => {
    if (!s) return 'Sedang Diproses';
    return ({ 
      open: 'Sedang Diproses', 
      in_progress: 'Sedang Diproses', 
      fixed: 'Sedang Diproses', 
      verified: 'Berhasil', 
      closed: 'Berhasil dengan catatan', 
      rejected: 'Gagal' 
    })[s] || 'Sedang Diproses';
  },
  bugStatusColor: (s) => ({ 
    open: 'info', 
    in_progress: 'info', 
    fixed: 'info', 
    verified: 'success', 
    closed: 'warning', 
    rejected: 'danger' 
  })[s] || 'secondary',
  appStatusColor: (s) => ({ pending:'secondary', testing:'warning', in_progress:'primary', selesai:'success' })[s] || 'secondary',
  priorityColor: (s) => ({ high:'danger', medium:'warning', low:'info' })[s] || 'secondary',
  capitalize: (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
  },
  hasRole: (user, ...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  },
  truncate: (str, length = 60) => {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
  }
};

module.exports = helpers;