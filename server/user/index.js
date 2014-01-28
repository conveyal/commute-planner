/**
 * Dependencies
 */

var auth = require('../auth');
var express = require('express');
var User = require('./model');

/**
 * Expose `app`
 */

var app = module.exports = express();

/**
 * Get all users
 */

app.get('/', auth.isLoggedIn, auth.isAdmin, function(req, res) {
  User.find().exec(function(err, users) {
    if (err) {
      res.send(400, err);
    } else {
      res.send(200, users);
    }
  });
});

/**
 * Create a user
 */

app.post('/', auth.isLoggedIn, auth.isAdmin, function(req, res) {
  User.create(req.body, function(err, user) {
    if (err) {
      if (err.name === 'MongoError' && err.code === 11000) {
        res.send(409, new Error('Resource exists with that information.'));
      } else {
        res.send(400, err);
      }
    } else {
      res.send(201, user);
    }
  });
});

/**
 * Change password request
 */

app.post('/change-password-request', function(req, res) {
  User
    .findOne()
    .where('email', req.body.email)
    .exec(function(err, user) {
      if (err) {
        res.send(400, err);
      } else if (!user) {
        res.send(404, 'Email does not exist.');
      } else {
        user.sendChangePasswordRequest(function(err) {
          if (err) {
            res.send(400, err);
          } else {
            res.send(204);
          }
        });
      }
    });
});

/**
 * Change password
 */

app.post('/change-password', function(req, res) {
  if (!req.body.change_password_key || req.body.change_password_key.length ===
    0)
    return res.send(404, 'Invalid change password key');

  User
    .findOne()
    .where('change_password_key', req.body.change_password_key)
    .exec(function(err, user) {
      if (err) {
        res.send(400, err);
      } else if (!user) {
        res.send(404,
          'Invalid change password key. Submit a change password request and use the generated link sent in the email.'
        );
      } else {
        user.password = req.body.password;
        user.save(function(err) {
          if (err) {
            res.send(400, err);
          } else {
            res.send(204);
          }
        });
      }
    });
});

/**
 * Middleware to retrieve a user by id
 */

function get(req, res, next) {
  User.findById(req.params.id).exec(function(err, user) {
    if (err) {
      res.send(400, err);
    } else if (!user) {
      res.send(404, 'User does not exist.');
    } else {
      req.user = user;
      next();
    }
  });
}

/**
 * Get a specific user
 */

app.get('/:id', auth.isLoggedIn, auth.isAdmin, get, function(req, res) {
  res.send(200, req.user);
});

/**
 * Update a user
 */

app.put('/:id', auth.isLoggedIn, auth.isAdmin, get, function(req, res) {
  req.user.email = req.body.email;
  req.user.password = req.body.password;
  req.user.save(function(err) {
    if (err) {
      res.send(400, err);
    } else {
      res.send(204);
    }
  });
});

/**
 * Delete a user
 */

app.delete('/:id', auth.isLoggedIn, auth.isAdmin, get, function(req, res) {
  req.user.remove(function(err) {
    if (err) {
      res.send(400, err);
    } else {
      res.send(204);
    }
  });
});
