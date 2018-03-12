{ /* global Node NodeList HTMLInputElement HTMLTextAreaElement Text */
  const infinify = (fn, reflect = false) => new Proxy(fn, {
    get: (fn, key) =>
      (reflect && key in fn && Reflect.get(fn, key)) || fn.bind(undefined, key)
  })

  const emitter = (host = {}, listeners = new Map()) => Object.assign(host, {
    listeners,
    emit: infinify((event, ...data) => {
      if (listeners.has(event)) {
        for (const h of listeners.get(event)) h.apply(undefined, data)
      }
    }),
    emitAsync: infinify((event, ...data) => {
      if (listeners.has(event)) {
        setTimeout(() => {
          for (const h of listeners.get(event)) {
            setTimeout(() => {
              h.apply(undefined, data)
            }, 0)
          }
        })
      }
    }),
    on: infinify((event, handler) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event).add(handler)
      return () => host.off(event, handler)
    }),
    once: infinify((event, handler) => host.on(event, function h () {
      handler(...arguments)
      host.off(event, h)
    })),
    off: infinify((event, handler) => {
      if (listeners.has(event)) {
        // ls = listener Set
        const ls = listeners.get(event)
        ls.delete(handler)
        if (!ls.size) listeners.delete(event)
      }
    })
  })

  const isArr = Array.isArray
  const isDef = o => o !== undefined && o !== null
  const isNil = o => o === undefined || o === null
  const isObj = o => o && o.constructor === Object
  const isStr = o => typeof o === 'string'
  const isInput = o => o instanceof HTMLInputElement || o instanceof HTMLTextAreaElement
  const isArrlike = o => isArr(o) || o instanceof NodeList || (isDef(o) && !(o instanceof Function || o instanceof Node) && o.length % 1 === 0)
  const isPromise = o => typeof o === 'object' && isFunc(o.then)
  const isRegExp = o => o instanceof RegExp
  const isFunc = o => o instanceof Function

  const allare = (arr, like) => {
    if (isArrlike(arr)) {
      const isfn = isFunc(like)
      for (let i = 0; i < arr.length; i++) {
        if (!(isfn ? like(arr[i]) : arr[i] === like)) {
          return false
        }
      }
      return true
    }
    return false
  }

  const flatten = (arr, result = [], encaptulate = true) => {
    if (encaptulate && !isArr(arr)) return [arr]
    for (var i = 0; i < arr.length; i++) {
      isArr(arr[i]) ? flatten(arr[i], result) : result.push(arr[i])
    }
    return result
  }

  const map2json = (map, obj = {}) => {
    map.forEach((val, key) => { obj[key] = val })
    return JSON.stringify(obj)
  }

  // simple global variable but you could export here
  var SuperModel = (data, mitter = emitter(), store = new Map()) => {
    let Model
    const {emit, emitAsync, on, once} = mitter

    function del (key, silent) {
      if (isStr(silent) && allare(arguments, isStr)) {
        for (var i = 0; i < arguments.length; i++) {
          del(arguments[i], silent)
        }
      } else {
        store.delete(key)
        if (!silent) {
          emit('delete', key)
          emit('delete:' + key)
        }
      }
      return mut
    }

    const has = key => store.has(key)

    const mut = (key, val, silent) => {
      if (typeof key === 'string') {
        const oldval = store.get(key)
        if (isDef(val) && val !== oldval) {
          store.set(key, val)
          if (!silent) {
            emit('set', key, val)
            emit('set:' + key, val)
          }
          return val
        }
        if (!silent) {
          emit('get', key)
          emit('get:' + key)
        }
        return oldval
      } else if (isObj(key)) {
        for (const k in key) {
          isNil(key[k]) ? del(k, val) : mut(k, key[k], val)
        }
      } else if (isArr(key)) {
        for (var i = 0; i < key.length; i++) mut(key[i][0], key[i][1], val)
      }
      return Model
    }

    const syncs = new Map()
    const sync = new Proxy(function (obj, key, prop = key) {
      if (isArr(obj)) {
        const args = Array.from(arguments).slice(1)
        if (args.every(isStr)) return sync.template(obj, ...args)
      }
      let isinput = isInput(obj) || obj.isContentEditable
      if (isinput) {
        [prop, key] = [key, obj.isContentEditable ? 'innerText' : 'value']
      }
      if (!syncs.has(obj)) syncs.set(obj, new Map())

      let action = 'set'
      if (prop.includes(':')) {
        [action, prop] = prop.split(':')
        var valid = action === 'valid'
        var iscomputed = action === 'compute'
        if (valid) action = 'validate'
      }

      syncs
        .get(obj)
        .set(
          prop,
          on(
            action + ':' + prop,
            val => {
              if (!isinput || obj[key].trim() !== val) obj[key] = val
            }
          )
        )

      if (!valid && isinput) {
        const update = () => {
          mut(prop, obj[key].trim())
          if (validators.has(prop)) validateProp(prop)
        }
        if (!has(prop)) update()
        obj.addEventListener('input', update)
        var stop = () => obj.removeEventListener('input', update)
      }

      if (valid) {
        obj[key] = validateProp(prop)
      } else if (iscomputed && computed.has(prop)) {
        obj[key] = compute(prop)
      } else if (has(prop)) {
        obj[key] = mut(prop)
      }

      once('delete:' + prop, () => {
        stop && stop()
        sync.stop(obj, prop)
      })
      return obj
    }, {
      get (fn, prop) {
        if (Reflect.has(fn, prop)) {
          return Reflect.get(fn, prop)
        } else {
          return (obj, key) => {
            if (isNil(obj)) return sync.text(prop)
            if (isNil(key)) key = prop
            return fn(obj, key, prop)
          }
        }
      }
    })

    sync.stop = (obj, prop) => {
      if (has(obj)) {
        const syncedProps = syncs.get(obj)
        if (!prop) {
          syncedProps.forEach(ln => ln.off()).clear()
        } else if (syncedProps.has(prop)) {
          syncedProps.get(prop).off()
          syncedProps.delete(prop)
        }
        if (!syncedProps.size) syncs.delete(obj)
      }
      return obj
    }

    sync.text = new Proxy(
      prop => sync(new Text(), 'textContent', prop),
      {get: (fn, prop) => fn(prop)}
    )

    sync.template = (strings, ...keys) => flatten(
      keys.reduce(
        (prev, cur, i) => [prev, sync.text(cur), strings[i + 1]],
        strings[0]
      ).filter(
        s => !isStr(s) || s.length
      )
    )

    const Async = new Proxy((key, fn) => has(key) ? fn(store.get(key)) : once('set:' + key, fn), {
      get: (_, key) => new Promise(resolve => {
        has(key) ? resolve(store.get(key)) : once('set:' + key, resolve)
      }),
      set: (_, key, val) => val.then(mut.bind(undefined, key))
    })

    const validators = new Map()
    const validateProp = key => {
      const valid = store.has(key) && validators.has(key) && validators.get(key)(store.get(key))
      emit('validate:' + key, valid)
      emit('validate', key, valid)
      return valid
    }

    const Validation = new Proxy((key, validator) => {
      if (isNil(validator)) return validateProp(key)
      if (isRegExp(validator)) {
        const regexp = validator
        validator = val => isStr(val) && regexp.test(val)
      }
      if (isFunc(validator)) {
        if (typeof validator() !== 'boolean') {
          throw new Error(`".${key}": validator invalid`)
        }
        validators.set(key, validator)
      }
    }, {
      get: (_, key) => validateProp(key),
      set: (vd, key, val) => vd(key, val)
    })

    const computed = new Map()
    const compute = new Proxy(function (key, computation) {
      if (isFunc(computation)) computed.set(key, computation)
      else if (isStr(computation)) {
        if (allare(arguments, isStr)) {
          const result = {}
          for (let i = 0; i < arguments.length; i++) {
            result[arguments[i]] = compute(arguments[i])
          }
          return result
        }
      }
      if (computed.has(key)) {
        const computeProp = computed.get(key)
        const result = computeProp(Model)
        if (computeProp.result !== result) {
          emitAsync('compute:' + key, result)
          emitAsync('compute', key, result)
          computeProp.result = result
        }
        return result
      } else if (isObj(key)) {
        for (const k of key) compute(k, key[k])
      }
    }, {
      get: (fn, key) => fn(key),
      set: (fn, key, computation) => fn(key, computation)
    })

    const toJSON = () => map2json(store)
    const toArray = () => Array.from(store.entries())
    const toJSONArray = () => JSON.stringify(toArray())

    const map = fn => {
      store.forEach((val, key) => {
        const newVal = fn(val, key)
        if (!isNil(newVal) && newVal !== val) {
          store.set(key, val)
        }
      })
      return Model
    }

    const filter = fn => {
      store.forEach((val, key) => {
        !fn(val, key) && store.delete(key)
      })
      return Model
    }

    // merge data into the store Map (or Map-like) object
    if (isStr(data)) {
      try { mut(JSON.parse(data), true) } catch (e) {}
    } else if (isDef(data)) {
      mut(data, true)
    }

    Model = new Proxy(
      Object.assign(
        mut,
        mitter,
        {
          compute,
          async: Async,
          valid: Validation,
          each: fn => {
            store.forEach(fn)
            return Model
          },
          has,
          del,
          map,
          filter,
          store,
          sync,
          syncs,
          toJSON,
          toArray,
          toJSONArray
        }
      ),
      {
        get: (o, key) => Reflect.has(o, key) ? o[key] : key === 'size' ? store.size : mut(key),
        set: (_, key, val) => isPromise(val) ? Async(key, val) : mut(key, val),
        delete: (_, key) => del(key)
      }
    )
    return Model
  }
  SuperModel.emitter = emitter
}
