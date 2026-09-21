// Runs once in the main process before workers spawn, so every test worker inherits the zone.
export default function setup() {
  process.env.TZ = 'Africa/Johannesburg'
}
