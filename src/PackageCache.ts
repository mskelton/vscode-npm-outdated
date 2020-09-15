import { PackageInfo } from "./models"

interface CacheItem extends PackageInfo {
  expiresAt: number
}

const MAX_LENGTH = 200
const MAX_AGE = 1.08e7 // 3 hours

export class PackageCache {
  private cache: CacheItem[] = []

  constructor(private maxLength = MAX_LENGTH, private maxAge = MAX_AGE) {}

  get(name: string) {
    const index = this.cache.findIndex((item) => item.name === name)
    const item = this.cache[index]

    if (item) {
      // Remove the item from the cache, if it is not expired, it will be
      // re-added to the beginning of the cache.
      this.cache.splice(index, 1)

      // If the item is not expired, add it back to the cache as the first
      // item since it is now the most recently used item.
      if (item.expiresAt >= Date.now()) {
        this.cache.unshift(item)
        return item
      }
    }
  }

  set(packageInfo: PackageInfo) {
    this.cache.unshift({
      ...packageInfo,
      expiresAt: Date.now() + this.maxAge,
    })

    // Resize the array to prevent overfilling the cache
    this.cache.length = Math.min(this.cache.length, this.maxLength)
  }
}
