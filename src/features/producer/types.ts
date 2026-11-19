import type { z } from "zod";
import type { producerDto, producerFormSchema } from "./schemas";

export type Producer = z.infer<typeof producerDto>;
export type ProducerFormValues = z.infer<ReturnType<typeof producerFormSchema>>;

/** Body `POST` / `PUT /producers` (BE `ProducerRequest`); `code` chỉ khi tạo, `status` + `version` chỉ khi sửa. */
export interface ProducerBody {
  code?: string;
  name: string;
  contactName?: string;
  contactPhone?: string;
  email?: string;
  channel: Producer["channel"];
  standardLeadDays?: number;
  note?: string;
  status?: Producer["status"];
  version?: number;
}

export interface UpdateProducerInput {
  id: string;
  body: ProducerBody;
}
