{
  const isDef = o => o !== undefined
  const isObj = o => o && o.constructor === Object

  const funcConstruct = Obj => (...args) => new Obj(...args)
  const $map = funcConstruct(Map)
  const $set = funcConstruct(Set)
  const $proxy = funcConstruct(Proxy)
  const $promise = funcConstruct(Promise)

  const listMap = (map = $map()) => Object.assign(
    (key, val) => (
      isDef(val) ? (map.has(key) ? map : map.set(key, $set())).get(key).add(val) : map.get(key)
    ),
    {
      map,
      del (key, val) {
        map.has(key) && map.get(key).delete(val).size < 1 && map.delete(key)
      },
      has (key, val) {
        const list = map.get(key)
        return isDef(val) ? list && list.has(val) : !!list
      },
      each (key, fn) { map.has(key) && map.get(key).forEach(fn) }
    }
  )

  const infinifyFN = (fn, reflect = true) => $proxy(fn, {
    get (_, key) {
      if (reflect && Reflect.has(fn, key)) return Reflect.get(fn, key)
      return fn.bind(null, key)
    }
  })

  const runAsync = (fn, ...args) => $promise((resolve, reject) => {
    try {
      resolve(fn(...args))
    } catch (e) {
      reject(e)
    }
  })

  const mergeObjs = (host, ...objs) => {
    objs.forEach(obj => { host = Object.assign(host, obj) })
    return host
  }

  const emitter = (host = {}) => {
    const listeners = listMap()
    // extract listener functions from object and arm them
    const listenMulti = (obj, justonce) => {
      for (const key in obj) obj[key] = listen(key, obj[key], justonce)
      return obj
    }
    // arm listener
    const listen = (name, fn, justonce = false) => {
      if (isObj(name)) return listenMulti(name, justonce)
      const ln = (...data) => fn(...data)
      const setln = state => {
        listeners.del(name, ln)
        ln.once = state
        listeners(name, ln)
        return ln
      }
      ln.off = () => {
        listeners.del(name, ln)
        return ln
      }
      ln.on = () => setln(false)
      ln.once = () => setln(true)
      return setln(justonce)
    }

    const on = infinifyFN((name, fn) => listen(name, fn))
    const once = infinifyFN((name, fn) => listen(name, fn, true))

    const emit = infinifyFN((name, ...data) => {
      listeners.each(name, ln => {
        runAsync(ln, ...data)
        if (ln.once) ln.off()
      })
    }, false)

    return mergeObjs(host, {emit, on, once, listen, listeners})
  }

  const map2json = (map, obj = {}) => {
    map.forEach((val, key) => { obj[key] = val })
    return JSON.stringify(obj)
  }

  // simple global variable but you could export here
  var SuperModel = (data = {}, store = $map()) => {
    const mitter = emitter()
    const {emit, on, once} = mitter

    const del = key => {
      store.delete(key)
      emit('delete', key)
      emit('delete:' + key)
    }

    const has = key => store.has(key)

    const mut = (key, val, silent) => {
      if (isObj(key)) {
        for (let k in key) mut(k, key[k], val)
        return mut
      }
      const oldval = store.get(key)
      if (isDef(val) && val !== oldval) {
        store.set(key, val)
        if (!silent) {
          emit('set', key, val)
          emit('set:' + key, val)
        }
        return mut
      }
      if (!silent) {
        emit('get', key)
        emit('get:' + key)
      }
      return oldval
    }
    // merge data into the store Map (or Map-like) object
    mut(data)

    const syncs = $map()
    const sync = (obj, key, prop = key) => {
      if (!syncs.has(obj)) syncs.set(obj, $map())
      syncs.get(obj).set(prop, on('set:' + prop, val => { obj[key] = val }))
      if (has(prop)) obj[key] = store.get(prop)
      return obj
    }
    sync.stop = (obj, prop) => {
      if (has(obj)) {
        const syncedProps = syncs.get(obj)
        if (!prop) syncedProps.forEach(ln => ln.off()).clear()
        else if (syncedProps.has(prop)) {
          syncedProps.get(prop).off()
          syncedProps.delete(prop)
        }
        if (!syncedProps.size) syncs.delete(obj)
      }
      return obj
    }

    const Async = $proxy((key, fn) => {
      has(key) ? fn(store.get(key)) : once('set:' + key, fn)
    }, {
      get: (_, key) => $promise(resolve => {
        has(key) ? resolve(store.get(key)) : once('set:' + key, resolve)
      }),
      set: (_, key, val) => val.then(v => mut(key, v))
    })

    const validators = $map()
    const validateProp = key => {
      const valid = store.has(key) && validators.has(key) && validators.get(key)(store.get(key))
      emit('validate:' + key, valid)
      emit('validate', key, valid)
      return valid
    }

    const Validation = $proxy((key, validator) => {
      if (!isDef(validator)) return validateProp(key)
      if (validator instanceof RegExp) {
        const regexp = validator
        validator = val => typeof val === 'string' && regexp.test(val)
      }
      if (validator instanceof Function) {
        validators.set(key, validator)
      }
    }, {
      get: (_, key) => validateProp(key),
      set: (vd, key, val) => vd(key, val)
    })

    const toJSON = () => map2json(store)

    return $proxy(
      mergeObjs(mut, {has, store, sync, syncs, del, toJSON}, mitter),
      {
        get (o, key) {
          if (Reflect.has(o, key)) return Reflect.get(o, key)
          if (key === 'async') return Async
          else if (key === 'valid') return Validation
          return mut(key)
        },
        set: (_, key, val) => val && val.constructor === Promise ? (Async[key] = val) : mut(key, val),
        delete: (_, key) => del(key)
      }
    )
  }

  SuperModel.runAsync = runAsync
  SuperModel.listMap = listMap
  SuperModel.emitter = emitter
}
