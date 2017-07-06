var debounce = require('debounce')
var reactiveSelect = require('../reactive-select')
var view = require('../view')
var session = require('../session')
var _tr = require('../translate')

var View = module.exports = view(require('./template.html'), function (view, plan) {
  _tr.inHTML(view, "option")
  _tr.inHTML(view, ".btn-dark")
  _tr.inHTML(view, "label")
  view.reactive.use(reactiveSelect)
  view.on('active', function () {
    plan.updateRoutes()
  })
  view.on('selected', function () {
    plan.updateRoutes()
  })
})

var times = hourOptions()

View.prototype.startTimes = function () {
  return times.slice(0, -1)
}

View.prototype.endTimes = function () {
  return times.slice(1)
}

View.prototype.bikeSpeeds = function () {
  return [8, 10, 12, 14, 16, 18, 20].map(function (s) {
    return {
      name: s + ' km/h',
      value: s
    }
  })
}

View.prototype.bikeTrafficStressLevels = function () {
  return [1, 2, 3, 4].map(function (l) {
    return {
      name: 'Level ' + l,
      value: l
    }
  })
}

View.prototype.walkSpeeds = function () {
  return [3, 4, 5, 6].map(function (s) {
    return {
      name: parseInt(s, 10) + ' km/h&nbsp;&nbsp;',
      value: s
    }
  })
}

View.prototype.parseInt = parseInt

function hourOptions () {
  var times = []
  for (var i = 0; i <= 24; i++) {
    times.push(toOption(i))
  }
  return times
}

function toOption (n) {
  var opt = {
    name: '',
    value: n
  }

  if (n > 23 || n === 0) opt.name = _tr('Midnight')
  //else if (n > 12) opt.name = n - 12 + 'pm'
  else if (n > 12) opt.name = n + 'h'
  else if (n === 12) opt.name = _tr('Noon')
  //else opt.name = n + 'am'
  else opt.name = n + 'h'

  return opt
}

View.prototype.showSettings = function () {
  this.find('.ExpandedSettings').classList.add('open')
}

View.prototype.hideSettings = function () {
  this.find('.ExpandedSettings').classList.remove('open')
}

View.prototype.save = debounce(function (e) {
  var names = ['maxBikeTime', 'maxWalkTime', 'carParkingCost', 'carCostPerMile']
  var self = this
  var values = {}
  names.forEach(function (n) {
    values[n] = parseFloat(self.find('input[name=' + n + ']').value)
  })
  var scorer = this.model.scorer()
  scorer.rates.carParkingCost = values.carParkingCost
  scorer.rates.mileageRate = values.carCostPerMile
  this.model.set(values)
  this.model.updateRoutes()
  this.saveProfile()
}, 1000)

View.prototype.saveProfile = function () {
  var self = this

  if (session.user()) {
    setTimeout(function () {
      var customData = session.user().customData()
      if (!customData.modeify_opts) customData.modeify_opts = {}
      customData.modeify_opts.bikeSpeed = self.model.bikeSpeed()
      customData.modeify_opts.walkSpeed = self.model.walkSpeed()
      customData.modeify_opts.maxBikeTime = self.model.maxBikeTime()
      customData.modeify_opts.maxWalkTime = self.model.maxWalkTime()
      customData.modeify_opts.carParkingCost = self.model.carParkingCost()
      customData.modeify_opts.carCostPerMile = self.model.carCostPerMile()
      customData.modeify_opts.bikeTrafficStress = self.model.bikeTrafficStress()

      session.user().customData(customData)
      session.user().saveCustomData(function () {}) // TODO: handle error
    }, 1000)
  }
}
