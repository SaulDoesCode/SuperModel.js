{
  const listMap = (store = new Map(), lm = {
    get: name => store.get(name),
    set (name, val) {
      (store.has(name) ? store : store.set(name, new Set())).get(name).add(val)
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

  const infinifyFN = (fn, reflect = true) => new Proxy(fn, {
    get (_, key) {
      if (reflect && Reflect.has(fn, key)) return Reflect.get(fn, key)
      return fn.bind(null, key)
    }
  })

  const runAsync = (fn, ...args) => new Promise((resolve, reject) => {
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

    const on = infinifyFN((name, fn) => {
      listeners.set(name, fn)
      return armln(name, fn)
    })

    const once = infinifyFN((name, fn) => {
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

    return {emit,emitAsync,on,once,listen}
  }

  // simple global variable but you could export here
  var SuperModel = (data = {}, store = new Map()) => {

    const mitter = emitter()
    const {emit,emitAsync,on,once,listen} = mitter

    const del = key => {
      store.delete(key)
      emit('delete', key)
      emit('delete:' + key)
    }

    const has = key => store.has(key)

    const mut = (key, val) => {
      if (key && key.constructor === Object) {
        for (let k in key) mut(k, key[k])
        return mut
      }
      const oldval = store.get(key)
      if (val !== undefined && val !== oldval) {
        store.set(key, val)
        emit('set', key, val)
        emit('set:' + key, val)
        return mut
      }
      emit('get', key)
      emit('get:' + key)
      return oldval
    }
    // merge data into the store Map (or Map-like) object
    mut(data)

    const syncs = new Map()
    const sync = (obj, key, prop = key) => {
      if (!syncs.has(obj)) syncs.set(obj, new Map())
      syncs.get(obj).set(prop, on('set:' + prop, val => {
        obj[key] = val
      }))
      if (store.has(key)) obj[key] = store.get(key)
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

    const Async = new Proxy((key, fn) => {
      has(key) ? fn(store.get(key)) : once('set:'+key, fn)
    }, {
      get: (_, key) => new Promise(resolve => {
        has(key) ? resolve(store.get(key)) : once('set:' + key, resolve)
      }),
      set(_, key, val) {
        val.then(mut.bind(null, key))
      }
    })

    return new Proxy(
        mergeObjs(mut, {has, store, sync, syncs, del}, mitter),
        {
          get (o, key) {
            if (Reflect.has(o, key)) return Reflect.get(o, key)
            if (key === 'async') return Async
            return mut(key)
          },
          set (_, key, val) {
            if (val && val.constructor === Promise) return Async[key] = val
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
