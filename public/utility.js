// limit the number of events per second
export const throttle = (callback, delay) => {
  let previousCall = new Date().getTime();
  return (...args) => {
    const time = new Date().getTime();
    if (time - previousCall < delay) return;
    previousCall = time;
    callback(...args);
  };
};

export const debounce = (callback, timeout = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      callback(...args);
    }, timeout);
  };
};
