export type StorageDisclosureCopy = {
  title: string;
  description: string;
};

export function getPromptPayStorageDisclosure(isSharedDataset: boolean): StorageDisclosureCopy {
  return isSharedDataset
    ? {
        title: "บันทึกใน shared dataset สาธารณะ",
        description: "PromptPay ID จะถูกบันทึกใน shared dataset บน Supabase ผู้เข้าถึงแอป/API อ่านหรือแก้ไขได้ และ ID อาจปรากฏใน QR บิลหรือไฟล์สำรอง",
      }
    : {
        title: "ข้อมูลเก็บในอุปกรณ์นี้เท่านั้น",
        description: "PromptPay ID จะถูกฝังใน QR และอยู่ในไฟล์สำรองของคุณ ผู้ที่เห็นหรือได้รับบิลอาจอ่าน ID นี้ได้",
      };
}

export function getExpenseStorageDisclosure(isSharedDataset: boolean): StorageDisclosureCopy {
  return isSharedDataset
    ? {
        title: "บันทึกใน shared dataset สาธารณะ",
        description: "รายการนี้จะบันทึกใน shared dataset บน Supabase ผู้เข้าถึงแอป/API ทุกคนอ่านหรือแก้ไขได้ และรวมอยู่ในไฟล์สำรอง RoomRent",
      }
    : {
        title: "จัดเก็บบนอุปกรณ์นี้",
        description: "รายการนี้จะบันทึกไว้ในอุปกรณ์และรวมอยู่ในไฟล์สำรอง RoomRent",
      };
}
