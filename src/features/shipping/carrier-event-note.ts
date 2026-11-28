/** BE lưu `resultNote` bằng tiếng Anh; diễn giải các lý do đối soát cần hành động bằng tiếng Việt. */
export function carrierEventResultNote(note: string | null | undefined): string | null {
  if (!note) return null;
  let match = /^No load holds order (.+) of carrier (.+)$/.exec(note);
  if (match) return `Chưa tìm thấy chuyến giữ đơn ${match[1]} của hãng ${match[2]}.`;
  match = /^No load (.+)$/.exec(note);
  if (match) return `Không tìm thấy chuyến ${match[1]}.`;
  match = /^Load (.+) is not booked with carrier (.+)$/.exec(note);
  if (match) return `Chuyến ${match[1]} thuộc hãng khác, không phải ${match[2]}.`;
  match = /^Load (.+) is cancelled(?: \(.+\))?$/.exec(note);
  if (match) return `Chuyến ${match[1]} đã huỷ nên sự kiện không được áp dụng.`;
  match = /^Order (.+) is no longer load (.+)'s/.exec(note);
  if (match) return `Đơn ${match[1]} không còn thuộc chuyến ${match[2]}.`;
  match = /^Load (.+) no longer needs order (.+),/.exec(note);
  if (match) return `Chuyến ${match[1]} không còn cần đơn ${match[2]}; liên hệ hãng để xử lý.`;
  match = /^Shipment (.+) did not leave on load (.+)$/.exec(note);
  if (match) return `Lô ${match[1]} không rời kho trên chuyến ${match[2]}.`;
  match =
    /^Drop-off (\d+) of order (.+) was made for shipment (.+), but the carrier reports (.+)$/.exec(
      note,
    );
  if (match)
    return `Điểm giao ${match[1]} của đơn ${match[2]} thuộc lô ${match[3]}, nhưng hãng báo lô ${match[4]}.`;
  if (note === "The same report was handled already")
    return "Báo cáo trùng: hệ thống đã xử lý trước đó.";
  if (note === "The same report was applied at the same moment")
    return "Báo cáo trùng: hệ thống vừa xử lý cùng nội dung này.";
  match = /^Waybill (.+) is (.+)'s already$/.exec(note);
  if (match) return `Mã vận đơn ${match[1]} đã thuộc chuyến ${match[2]}.`;
  match = /^Load (.+) left with waybill number (.+); the carrier now reports (.+)$/.exec(note);
  if (match)
    return `Chuyến ${match[1]} đã rời kho với mã ${match[2]}, nhưng hãng vừa báo mã ${match[3]}. Cần đối soát với hãng.`;
  match = /^Order (.+) has no drop-off (\d+)$/.exec(note);
  if (match) return `Đơn hãng ${match[1]} không có điểm giao số ${match[2]}.`;
  return note.trim();
}
