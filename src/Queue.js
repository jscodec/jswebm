class Queue {
  constructor(internalLength) {
    this.bufferLength = internalLength;
    this.buffer = new Array(internalLength);
    this.length = 0;
    this.head = 0;
    this.tail = 0;
  }

  push(obj) {
    if ((this.length + 1) > this.bufferLength) {
      this.resizeBuffer();
    }
    this.buffer[this.head] = obj;
    this.length++;
    this.head = (this.head + 1) % this.bufferLength;
  }

  resizeBuffer() {
    this.bufferLength = this.bufferLength << 1;
    var newBuffer = new Array(this.bufferLength);
    for (var i = this.tail; i < this.head; i++) {
      newBuffer[i] = this.buffer[i];
    }
    this.buffer = newBuffer;
  }

  shift() {
    const obj = this.buffer[this.tail];
    this.buffer[this.tail] = null;
    this.length--;
    this.tail = (this.tail + 1) % this.bufferLength;
    return obj;
  }

  peek() {
    return this.buffer[this.tail];
  }

  clear() {
    for (var i = 0; i < this.bufferLength; i++) {
      this.buffer[i] = null;
    }
    this.length = 0;
    this.tail = 0;
    this.head = 0;
  }
}

module.exports = Queue;
