# ssb-same-as

A [scuttlebot](https://github.com/ssbc/scuttlebot) plugin that provides a stream of which feeds are (and are not) the same as other feeds.

The basis for creating the illusion of multi-feed identities in SSB!

Based on [ssb-friends](https://github.com/ssbc/ssb-friends) and [graphreduce]((https://github.com/ssbc/graphreduce))

## TODO

- [ ] need to test merge blocking and unmerging

## Spec

### Assert that you are the same as another feed

```
{
  type: 'contact',
  contact: TARGET_FEED_ID,
  following: true, // for backwards compat reasons
  sameAs: true
}
```

### Block a `sameAs`

```
{
  type: 'contact',
  contact: TARGET_FEED_ID,
  following: true, // for backwards compat reasons
  sameAs: false
}
```

### Agree with another feed's assertion

```
{
  type: 'contact',
  contact: TARGET_FEED_ID,
  following: true, // for backwards compat reasons
  sameAs: {
    SOURCE_FEED_ID: true // or `false` to remove an agreement
  }
}
```

### Logic behind `sameAs` resolution

- If one side explicitly disagrees (with a `sameAs: false`), the identities will **NEVER be merged**.
- If both sides agree, the identity will **ALWAYS be merged**.
- If one side agrees (and the other side has not shared an opinion), and you agree, then the identities will be **merged**.
- In all other cases, the identities **will not be merged**.

This module uses graphreduce to walk the `sameAs` links, so this means that any topology of links will be resolved.

## Exposed API (as sbot plugin)

### sbot.sameAs.stream({live: false}) _source_

Gets a list of all of the resolved and verified `sameAs` links between feeds.

```
{from: 'a', to: 'b', value: true}
{from: 'a', to: 'c', value: true}
{from: 'a', to: 'd', value: true}
{from: 'b', to: 'a', value: true}
{from: 'b', to: 'c', value: true}
{from: 'b', to: 'd', value: true}
...
```

### sbot.sameAs.get({id}, cb) _async_

Gets a list of all of the verified `sameAs` links for a given feed.

```
{
  'b': true,
  'c': true,
  'd': true
}
```

## License

MIT
