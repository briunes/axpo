
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./react-email-editor.cjs.production.min.js')
} else {
  module.exports = require('./react-email-editor.cjs.development.js')
}
