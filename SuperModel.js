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

  var SuperModel = (store = new Map()) => {
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

    const infinifyFN = (fn, reflect = true) => new Proxy(fn, {
      get (_, key) {
        if (reflect && Reflect.has(fn, key)) return Reflect.get(fn, key)
        return fn.bind(null, key)
      }
    })

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
      listeners.each(name, ln => {
        ln(...vals)
      })
    }, false)

    const emitAsync = infinifyFN((name, ...vals) => {
      setTimeout(() => {
        listeners.each(name, ln => {
          setTimeout(() => {
            ln(...vals)
          }, 0)
        })
      }, 0)
    }, false)

    const del = key => {
      store.delete(key)
      emit('delete', key)
      emit('delete:' + key)
    }

    const mut = (key, val) => {
      if (key && key.constructor === Object) {
        for (let key in key) mut(k, key[k])
        return mut
      }
      const oldval = store.get(key)
      if (val !== undefined && val !== oldval) {
        store.set(key, val)
        emit('set', key, val)
        emit('set:' + key, val)
        return mut
      }
      return oldval
    }

    const syncs = new Map()
    const sync = (obj, key, prop = key) => {
      if (!syncs.has(obj)) syncs.set(obj, new Map())
      syncs.get(obj).set(prop, on('set:' + prop, val => {
        obj[key] = val
      }))
      if (store.has(key)) obj[key] = store.get(key)
      return obj
    }
    sync.node = (node, prop, key = 'textContent') => sync(node, key, prop)
    sync.stop = (obj, prop) => {
      if (syncs.has(obj)) {
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
      store.has(key) ? fn(store.get(key)) : once('set:'+key, fn)
    }, {
      get: (_, key) => new Promise(resolve => {
        store.has(key) ? resolve(store.get(key)) : once('set:' + key, resolve)
      })
    })

    return new Proxy(
      Object.assign(mut, {emit, emitAsync, listen, on, once, store, sync, syncs, del}),
        {
          get (o, key) {
            if (Reflect.has(o, key)) return Reflect.get(o, key)
            if (key === 'async') return Async
            return mut(key)
          },
          set (_, key, val) {
            if (val && val.constructor === Promise) return val.then(mut.bind(null, key))
            return mut(key, val)
          }
        }
    )
  }

  SuperModel.listMap = listMap
}