// Client-side presentation guard only. Seller verification must be enforced
// server-side before customer documents can become final or externally issued.
// Never interpret an Udyam identifier as a GSTIN.
export function udyamDisplayLine({sellerIdentityVerified=false,registrationNumber}={}) {
 if (sellerIdentityVerified !== true) return null;
 if (typeof registrationNumber !== 'string' ||
     !/^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/.test(registrationNumber))
   return null;
 return 'Udyam Registration No.: ' + registrationNumber;
}
