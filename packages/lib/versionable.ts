export type Versioned<T> = T & { _v: string | number }

type Versionable<T> = {
  create: (v: T) => Versioned<T>
  migrate: (v: any) => Versioned<T>
}

type GetType<V> = V extends Versionable<infer G> ? G : never

export function versionable<T, P extends Versionable<any> = Versionable<any>>(
  version: string | number,
  p?: P,
  mig?: (v: GetType<P>) => T
): Versionable<T> {
  return {
    create: (v: T) => ({ ...v, _v: version }),
    migrate: (v: Versioned<any>) => {
      if (v._v === version) return v
      if (!p || !mig) throw 'cannot migrate base impl'
      const sv = p.migrate(v)
      return { ...mig(sv), _v: version }
    },
  }
}
