import type { Server } from 'http';

export const getAddress = (s: Server): string => {
  const address = s.address();

  if (address == null) {
    throw new Error('Server does not have an address');
  }

  if (typeof address === 'string') {
    return address;
  }

  if (address.address === '127.0.0.1' || address.address === '::') {
    return `http://localhost:${address.port}`;
  }

  if (address.family === 'IPv4') {
    return `http://${address.address}:${address.port}`;
  }

  if (address.family === 'IPv6') {
    return `http://[${address.address}]:${address.port}`;
  }

  return `${address.address}:${address.port}`;
};
