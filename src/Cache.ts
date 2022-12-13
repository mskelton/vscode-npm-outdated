export class Cache<T> {
  private at: number

  constructor(public value: T) {
    this.at = Date.now()
    this.value = value
  }

  // Checks if the cache is still valid, being within lifetime.
  public isValid(lifetime: number) {
    return this.at >= Date.now() - lifetime
  }
}
