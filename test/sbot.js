var pull = require('pull-stream')
var tape = require('tape')
var createSbot = require('scuttlebot')
  .use(require('scuttlebot/plugins/replicate'))
  .use(require('../'))

var sbot = createSbot({
  temp: 'alice',
  port: 45451,
  host: 'localhost',
  timeout: 20001,
  replicate: {
    hops: 2,
    legacy: false
  }
})

tape('check updates to graph', function (t) {
  var changes = []

  pull(
    sbot.sameAs.stream({live: true}),
    pull.drain(function (m) { changes.push(m) })
  )

  var feedA = sbot.createFeed()
  var feedB = sbot.createFeed()
  var feedC = sbot.createFeed()
  var feedD = sbot.createFeed()

  // feedA -> feedB
  sbot.publish({
    type: 'contact',
    contact: feedA.id,
    following: true
  }, function () {
    t.equal(changes.length, 0, 'no change on follow')
    changes.length = 0

    feedA.publish({
      type: 'contact',
      contact: feedB.id,
      sameAs: true
    }, function () {
      t.equal(changes.length, 0, 'one sided sameAs ignored')
      changes.length = 0

      feedB.publish({
        type: 'contact',
        contact: feedA.id,
        sameAs: true
      }, function () {
        t.deepEqual(changes, [
          {from: feedA.id, to: feedB.id, value: true},
          {from: feedB.id, to: feedA.id, value: true}
        ], 'mutual sameAs merges')
        changes.length = 0

        feedC.publish({
          type: 'contact',
          contact: feedB.id,
          sameAs: true
        }, function () {
          t.equal(changes.length, 0, 'one sided sameAs ignored')
          changes.length = 0

          feedB.publish({
            type: 'contact',
            contact: feedC.id,
            sameAs: true
          }, function () {
            t.deepEqual(changes, [
              {from: feedA.id, to: feedC.id, value: true}, // join up with A!
              {from: feedB.id, to: feedC.id, value: true},
              {from: feedC.id, to: feedB.id, value: true},
              {from: feedC.id, to: feedA.id, value: true} // join up with A!
            ], 'sameAs chain joins up and merges all')
            changes.length = 0

            feedD.publish({
              type: 'contact',
              contact: feedC.id,
              sameAs: true
            }, function () {
              t.equal(changes.length, 0)
              changes.length = 0

              sbot.publish({
                type: 'contact',
                contact: feedD.id,
                sameAs: {[feedC.id]: true} // has to agree with a claim
              }, function () {
                t.deepEqual(changes, [
                  {from: feedA.id, to: feedD.id, value: true},
                  {from: feedB.id, to: feedD.id, value: true},
                  {from: feedC.id, to: feedD.id, value: true},
                  {from: feedD.id, to: feedC.id, value: true},
                  {from: feedD.id, to: feedB.id, value: true},
                  {from: feedD.id, to: feedA.id, value: true}
                ], 'join graph when local agreement')

                changes.length = 0
                checkNonRealtime()
              })
            })
          })
        })
      })
    })
  })

  function checkNonRealtime () {
    pull(
      sbot.sameAs.stream({live: false}),
      pull.collect(function (err, results) {
        if (err) throw err

        t.deepEqual(results, [
          {from: feedA.id, to: feedB.id, value: true},
          {from: feedA.id, to: feedC.id, value: true},
          {from: feedA.id, to: feedD.id, value: true},
          {from: feedB.id, to: feedA.id, value: true},
          {from: feedB.id, to: feedC.id, value: true},
          {from: feedB.id, to: feedD.id, value: true},
          {from: feedC.id, to: feedB.id, value: true},
          {from: feedC.id, to: feedD.id, value: true},
          {from: feedC.id, to: feedA.id, value: true},
          {from: feedD.id, to: feedC.id, value: true},
          {from: feedD.id, to: feedB.id, value: true},
          {from: feedD.id, to: feedA.id, value: true}
        ], 'non realtime: everything liked up!')

        t.end()
        sbot.close()
      })
    )
  }
})
