# 👯 SuperModel.js 👯
## Harness the power of proxies!

* +: no depencies
* +: small size
* -: only newer browsers supported

### Learn By Example

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
  listening.once() // listening just once
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
  model({
    PhilosophyOfTheDay: 'pragmatism'
  })

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



listmap is just an abstraction
using a Map containing Sets.  
This is used for the event loop
```js
  const lm = model.listMap()
  lm.del(key, val)
  lm.set(key, val)
  lm.get(key) // -> Set([val])
  lm.has(key) // -> bool Set exists
  lm.has(key, val) // -> bool Value in Set exists
  lm.each(key, val => {
    // loop over values in Set...
  })
```
