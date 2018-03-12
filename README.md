# 👯 SuperModel.js 👯
### Harness the power of proxies!

[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)

* +: no depencies
* +: small size, SuperModel.min.js is ~4.5kb uncompressed
* -: only works in environments supporting Proxy

you can install from npm: ``npm install --save super-model-js``

### API
* ``SuperModel( data = {}, emitter = SuperModel.emitter(), store = new Map() )`` - create a new model
* ``.on(type, func)``, ``.once(type, func)``- model event listener
* ``.on[type](func)``, ``.once[type](func)``- event listener, type as function property
* ``.emit(type, ...values)``- emit an event with values
* ``.emit[type](...values)``- emit, event type as a function property
* ``.emitAsync(type, ...values)``- emit an event with values (non-blocking)
* ``.del(key)``- delete model property
* ``model(key, =val)``- shorthand function based property get/set
* ``model({...props})``- update properties with an object
* ``model[prop]``- get/set model property
* ``model.async[prop]``- get/set model property using promises
* ``model.valid(key, =validator)``- make a property validate-able by adding a validator func/RegExp
* ``model.valid[prop]``- set - prop validator func/RegExp, get - run validator and get bool result
* ``.sync(obj, key, modelProperty = key)``- set and update a model property on an object
* ``.sync.stop(obj, key)``- stop syncing a model property on an object
* ``.store()``- Map containing all model properties
* ``.toJSON()`` - Get all model.store properties as JSON
* ``.toJSONArray()`` - Get all model.store properties as "[[key, val], ...]"
* ``.has(key)``- checks whether model.store has a certain key
* ``.emitter()``- just the event emitting part of the model

### Learn By Example

#### Async/Await Values

```js
  // view.js
  const model = SuperModel()
  feed.render(await model.async.news)

  // news.js
  model.news = await (await fetch('/latest')).json()

  // psst... it also works if you simply assign a promise as is
  model.news = (await fetch('/latest')).json()
```


#### Data Binding

```html
  <textarea id=txtarea>type something...</textarea>
  <article id=txtdisplay></article>
```

```js
const input = document.querySelector('#txtarea')
const output = document.querySelector('#txtdisplay')

const model = SuperModel()
model.sync.msg(input)
model.sync.msg(output, 'innerText')
```

#### Validate Properties

```js
  const model = SuperModel()
  model.valid.username = /^[a-zA-Z0-9._]{3,55}$/g
  model.username = '**Bad Username**'
  model.valid.username // -> false
  model.valid('username') // -> false


  model.ui = {...someUIcomponent}

  model.valid.ui = ui => !ui.hidden && ui.userlist.includes(model.username)
  // or
  model.valid('ui', ui => !ui.hidden && ui.userlist.includes(model.username))

  model.valid.ui // -> bool


  // listen for validation event
  model.on('validate:username', isValid => {
    // ...
  })
  // or
  model.on.validate((propName, isValid) => {
    if (propName === 'username') {
      // ...
    }
  })
```


#### Emit Events

more or less node.js style events
```js
  const model = SuperModel()

  model.on.myevent((...values) => {
    // ... do something
    console.log(...values)
  })

  model.emit.myevent('new', 'values')
  // or
  model.emit('myevent', 'newer', 'values')
```

stop and restart event listeners

```js
  const model = SuperModel()

  const listener = model.on.happening(() => {})
  listener.off() // no longer listening
  listener.on() // listening again
  listener.once() // listening just once

  // bonus, trigger the listener manually
  listener()
```

#### Mutations
internally all values are stored in a map
```js
  const model = SuperModel()
  model.store // -> Map{"key":"value"}

  // set
  model('key', 'value')
  model({ key: 'value' })
  model.key = 'value'

  // get
  model('key') // -> val
  model.key // -> val
  model.async.key // -> promise.then(val => {...})

  // delete
  model.del('key')
  delete model.key
```

##### listening to mutation events
there are 3 mutation types ``set, get, del``    
``model.on('type:key', val => {})``    
``model.on('type', (key, val) => {})``

```js
  const model = SuperModel()

  model.on('set:existentialism', val => {
    // render to dom or something...
  })
  // or
  model.on.set((key, val) => {
    if (key === 'existentialism') {
      // ...
    }
  })

  model.existentialism = 'What ever matters to you.'
```

#### other things
sync model values with other objects   
``.sync(obj, key, modelProperty = key)``,    
``.sync.stop(obj, key)``
```js
  const model = SuperModel()
  model({ PhilosophyOfTheDay: 'pragmatism' })

  const PHODelement = document.querySelector('#PHOD')

  // this keeps obj[key] updated with model[prop]
  model.sync(PHODelement, 'textContent', 'PhilosophyOfTheDay')

  if (nolongerToday) {
    // this will update the element's text
    model.PhilosophyOfTheDay = 'nominalism'
  } else if (fedUpWithPositivism) {
    model.PhilosophyOfTheDay = 'critical-realism'
  }

  // stop syncing
  model.sync.stop(PHODelement, 'textContent')
```

``.emitAsync`` is the same as ``.emit``   
it's just less slightly blocking by running the event loop    
and each event listener in a ``setTimeout(ln, 0)``
```js
  const model = SuperModel()
  model.emitAsync('evtType', ...['values'])
```
