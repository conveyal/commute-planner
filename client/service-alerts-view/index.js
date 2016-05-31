var moment = require('moment')

var view = require('../view')
var session = require('../session')

var AlertRow = require('./row')

/**
 * Expose `View`
 */

var View = view(require('./template.html'), function (view, model) {
})

View.prototype.hasAlerts = function () {
  return this.model.alerts && this.model.alerts.length > 0
}

/**
 * Set the routes view
 */

View.prototype['alerts-view'] = function () {
  return AlertRow
}

module.exports = function () {
  var activeAlerts = session.serviceAlerts().filter(function (alert) {
    var today = moment()
    var fromDate = moment(alert.fromDate)
    var toDate = moment(alert.toDate)
    return !fromDate.isAfter(today) && !toDate.isBefore(today)
  })

  return new View({
    alerts: activeAlerts
  })
}
