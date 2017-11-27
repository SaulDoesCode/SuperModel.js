{
  const isObj = o => o && o.constructor === Object

  const funcConstruct = Obj => (...args) => new Obj(...args)
  const $map = funcConstruct(Map)
  const $set = funcConstruct(Set)
  const $proxy = funcConstruct(Proxy)
  const $promise = funcConstruct(Promise)

  const listMap = (store = $map(), lm = {
    get: name => store.get(name),
    set (name, val) {
      (store.has(name) ? store : store.set(name, $set())).get(name).add(val)
      return lm
    },
    del (name, val) {
      if (store.has(name) && store.get(name).delete(val).size < 1) store.delete(name)
      return lm
    },
    has (name, val) {
      const nameExists = store.has(name)
      return val === undefined || !nameExists ? nameExists : store.get(name).has(val)
    },
    each (name, fn) {
      if (lm.has(name)) store.get(name).forEach(fn)
      return lm
    }
  }) => lm

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
    objs.forEach(obj => {
      host = Object.assign(host, obj)
    })
    return host
  }

  const emitter = () => {
    const listeners = listMap()

    const armln = (name, fn) => {
      fn.off = () => listeners.del(name, fn)
      fn.once = () => {
        fn.off()
        return once(name, fn)
      }
      fn.on = () => {
        fn.off()
        return on(name, fn)
      }
      return fn
    }

    const listenMulti = (obj, fn) => {
      for (let key in obj) {
        obj[key] = fn(obj[key])
      }
    }

    const on = infinifyFN((name, fn) => {
      if (isObj(name)) return listenMulti(name, on)
      listeners.set(name, fn)
      return armln(name, fn)
    })

    const once = infinifyFN((name, fn) => {
      if (isObj(name)) return listenMulti(name, once)
      const ln = (...vals) => {
        listeners.del(name, ln)
        return fn(...vals)
      }
      listeners.set(name, ln)
      return armln(name, ln)
    })

    const listen = (justonce, name, fn) => (justonce ? once : on)(name, fn)

    const emit = infinifyFN((name, ...vals) => {
      listeners.each(name, ln => ln(...vals))
    }, false)

    const emitAsync = infinifyFN((name, ...vals) => {
      runAsync(listeners.each, name, ln => runAsync(ln, ...vals))
    }, false)

    return {emit, emitAsync, on, once, listen}
  }

  const map2json = (map, obj = {}) => {
    map.forEach((val, key) => {
      obj[key] = val
    })
    return JSON.stringify(obj)
  }

  // simple global variable but you could export here
  var SuperModel = (data = {}, store = $map()) => {
    const mitter = emitter()
    const {emit, emitAsync, on, once} = mitter

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
      if (val !== undefined && val !== oldval) {
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
      syncs.get(obj).set(prop, on('set:' + prop, val => {
        obj[key] = val
      }))
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
      set (_, key, val) {
        val.then(mut.bind(null, key))
      }
    })

    const validators = $map()
    const validateProp = key => {
      const valid = store.has(key) && validators.has(key) && validators.get(key)(store.get(key))
      emitAsync('validate:' + key, valid)
      emitAsync('validate', key, valid)
      return valid
    }

    const Validation = $proxy((key, validator) => {
      if (validator === undefined) return validateProp(key)
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
        set (_, key, val) {
          if (val && val.constructor === Promise) {
            return (Async[key] = val)
          }
          return mut(key, val)
        },
        delete: (_, key) => del(key)
      }
    )
  }

  SuperModel.runAsync = runAsync
  SuperModel.listMap = listMap
  SuperModel.emitter = emitter
}
