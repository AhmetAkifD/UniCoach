/**
 * Ulaşılamayan yerel ağ adresine istek uzun süre asılı kalabilir; bu süre dolunca ağ hatası sayılır (çevrimdışı).
 * Hata `ApiError` değildir, bu yüzden çağıranlar "sunucuya ulaşılamadı" diye ele alır.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TypeError("Sunucu yanıt vermedi.")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
