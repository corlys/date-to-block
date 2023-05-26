export const sleep = (milliseconds: number): Promise<void> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, milliseconds);
  });
}

export const backoffAndRetry = async<T>(func: (...args: any[]) => Promise<T>, args: any[], retries = 3, delay = 1000): Promise<T> => {
  try {
    return await func(...args);
  } catch (error: any) {
    if (retries <= 0) {
      throw error;
    }
    console.log((error?.message.slice(0, 1000) ?? "none") + ` Retrying in ${delay / 1000} seconds...`)
    // console.log(`Error: ${error?.message}. Retrying in ${delay / 1000} seconds... params ${[...args?.slice(0, 70)]} time ${new Date().toISOString()}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return backoffAndRetry(func, args, retries - 1, delay * 2,);
  }
}
