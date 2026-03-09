const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (roles.includes(req.session.user.role)) return next();
    req.flash('error', 'Anda tidak memiliki akses ke halaman ini.');
    res.redirect('/dashboard');
  };
};

module.exports = { checkRole };