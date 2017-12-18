# 👯 SuperModel.js 👯
### Harness the power of proxies!

[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)

* +: no depencies
* +: small size, SuperModel.min.js is less than 3kb uncompressed
* -: only newer browsers supported

### API
* ``SuperModel( data = {}, store = new Map() )`` - create a new model
* ``.listen(type, func, justonce)``- event listener with option to listen once or not
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
* ``.has(key)``- checks whether model.store has a certain key
* ``.runAsync(func, ...args)``- runs a function (with its args) inside a promise
* ``.listMap()``- internal abstraction using a Map containing Sets
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
  const model = SuperModel()
  const txtarea = document.querySelector('#txtarea')
  const txtdisplay = document.querySelector('#txtdisplay')
  model.sync(txtdisplay, 'innerText', 'txt')

  model.txt = txtarea.value.trim()
  txtarea.addEventListener('input', e => {
    model.txt = txtarea.value.trim()
  })
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
  }

  // stop syncing
  model.sync.stop(PHODelement, 'textContent')
```

``.listen(justonce, evtType, fn)``   
for ease of use in special cases
```js
  const model = SuperModel()
  // once = true, on = false
  model.listen(true, 'nihilism', val => {
    console.log(val)
  })

  model.emit.nihilism('nothing has meaning') // logs
  model.emit.nihilism('nothing has meaning') // doesn't log
```

``.emitAsync`` is the same as ``.emit``   
it's just less slightly blocking by running the event loop    
and each event listener in a ``setTimeout(ln, 0)``
```js
  const model = SuperModel()
  model.emitAsync('evtType', ...['values'])
```


**listMap** is just a utility to manage a ``Map`` that contains ``Set``s
```javascript
  import dataGun from 'dataGun.mjs'
  const lm = dataGun.listMap()

  // set
  lm('key', 'value0')
  lm('key', 'value1')
  // get
  lm('key') // -> Set{'value0', 'value1'}
  // get the base map
  lm.map // -> Map{key: Set{...}}
  // has
  lm.has('key') // -> true
  lm.has('key', 'value2') // -> false
  // delete a value
  lm.del('key', 'value0')
  // or
  lm('key').delete('value0')

  // loop over contents
  lm.each('key', value => {
    console.log(value)
  })
  // value0
  // value1
  // ...
```
