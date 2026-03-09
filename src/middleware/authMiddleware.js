const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Silakan login terlebih dahulu.');
  res.redirect('/login');
};

const isGuest = (req, res, next) => {
  if (!req.session.user) return next();
  res.redirect('/dashboard');
};

module.exports = { isAuthenticated, isGuest };
