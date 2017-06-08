const Auth0Lock = require('auth0-lock').default
const page = require('page')

const session = require('../session')
const User = require('../user')

const lock = new Auth0Lock(
  process.env.AUTH0_CLIENT_ID,
  process.env.AUTH0_DOMAIN,
  {
    auth: {
      redirect: false,
      params: {
        scope: 'app_metadata email openid user_metadata'
      }
    },
    autoclose: true
  }
)

lock.on('authenticated', function (authResult) {
  lock.getProfile(authResult.idToken, function (error, profile) {
    if (error) {
      // Handle error
      return
    }

    session.user(new User(profile))
    session.isLoggedIn(true)

    page('/')
  })
})

lock.on('authorization_error', function (err) {
  console.error(err)
})

module.exports.show = function () {
  lock.show()
}