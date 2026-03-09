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
  statusColor: (s) => ({ open:'danger', in_progress:'warning', fixed:'primary', verified:'success', closed:'success', rejected:'dark' })[s] || 'secondary',
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