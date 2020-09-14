import { get } from "https"

export function request<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      let body = ""

      res.on("data", (chunk) => {
        body += chunk
      })

      res.on("end", () => {
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          // TODO
          reject(e)
        }
      })
    }).on("error", reject)
  })
}
