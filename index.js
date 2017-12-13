'use strict'
var G = require('graphreduce')
var F = require('ssb-friends/alg')

var Reduce = require('flumeview-reduce')
var pull = require('pull-stream')
var FlatMap = require('pull-flatmap')
var ref = require('ssb-ref')

exports.name = 'sameAs'
exports.version = require('./package.json').version
exports.manifest = {
  get: 'async',
  stream: 'source'
}

exports.init = function (sbot, config) {
  var g = {}
  var index = sbot._flumeUse('sameAs', Reduce(2, function (graph, rel) {
    if (!graph) graph = {}

    if (rel) {
      if (ref.isFeed(rel.from) && ref.isFeed(rel.to)) {
        var outgoing = G.get(graph, rel.from, rel.to) || []
        var incoming = G.get(graph, rel.to, rel.from) || []
        incoming[1] = outgoing[0] = rel.value
        G.addEdge(graph, rel.from, rel.to, outgoing)
        G.addEdge(graph, rel.to, rel.from, incoming)
      } else if (rel.localClaims) {
        G.eachEdge(rel.localClaims, (from, to, value) => {
          var outgoing = G.get(graph, from, to) || []
          var incoming = G.get(graph, to, from) || []
          outgoing[2] = incoming[2] = value
          G.addEdge(graph, from, to, outgoing)
          G.addEdge(graph, to, from, incoming)
        })
      }
    }
    return graph
  }, function (data) {
    if (isSameAsMsg(data)) {
      var author = data.value.author
      var contact = data.value.content.contact
      var sameAs = data.value.content.sameAs
      if (typeof sameAs === 'boolean') {
        return {
          from: author,
          to: contact,
          value: sameAs
        }
      } else if (data.value.content.sameAs instanceof Object && data.value.author === sbot.id) {
        return {
          localClaims: {
            [contact]: sameAs
          }
        }
      }
    }
  }, null, g))

  function get (id) {
    var graph = index.value.value
    return F.reachable(graph, id, {
      initial: undefined, reduce, expand
    })
  }

  function createSameAsStream ({live = false, sync = true, old = true} = {}) {
    var isSync = false
    var sameAs = {}

    return pull(
      index.stream({live}),
      pull.filter(),
      FlatMap(function (value) {
        var result = []
        var graph = index.value.value

        // TODO: this has to traverse the entire graph, should use the subset when realtime update
        G.eachEdge(graph, (from, to, values) => {
          var sameAs = get(from)

          // clear out unreachable keys
          for (let dest in sameAs[from]) {
            if (sameAs[dest] == null && sameAs[from] !== false) {
              update(from, dest, false)
            }
          }

          // update reachable
          for (let dest in sameAs) {
            if (sameAs[dest] != null && from !== dest) {
              update(from, dest, sameAs[dest])
            }
          }
        })

        if (!isSync) {
          isSync = true
          if (old === true) {
            if (sync && live) result.push({sync: true})
          } else {
            return []
          }
        }

        return result

        function update (from, to, value) {
          var lastValue = G.get(sameAs, from, to)
          if (lastValue !== value && !(lastValue == null && value === false)) {
            G.addEdge(sameAs, from, to, value)
            result.push({from, to, value})
          }
        }
      })
    )
  }

  // REPLICATION
  if (sbot.replicate) {
    // probably should sit on ssb-friends createFriendStream and then check emitted values for sameAs
    // TODO: add sameAs peers to replicate map
  }

  return {
    get: function (opts) {
      return get(opts.id)
    },
    stream: createSameAsStream
  }
}

function isSameAsMsg (msg) {
  return msg.value.content.type === 'contact' && ref.isFeed(msg.value.content.contact) && 'sameAs' in msg.value.content
}

function getValue (values) {
  // mutual sameAs
  if (values[0] && values[1]) {
    return true
  }

  // one party disagrees
  if (values[0] === false || values[1] === false) {
    return false
  }

  // partial with
  if ((values[0] || values[1]) && values[2]) {
    return true
  }
}

function reduce (target, source, value) {
  if (target !== false) {
    target = getValue(value)
  }
  return target
}

function expand (value) {
  return value != null
}
