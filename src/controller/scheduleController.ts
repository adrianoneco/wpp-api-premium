/*
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Request, Response } from 'express';
import { getModels } from '../util/db/mongo';
import { scheduleQueue } from '../queues/client';

export async function createSchedule(req: Request, res: Response) {
  /**
     #swagger.tags = ["Schedule"]
     #swagger.autoBody=false
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              phone: { type: "string" },
              message: { type: "string" },
              type: { type: "string", enum: ["text","file","image","location","link"] },
              payload: { type: "object" },
              scheduledAt: { type: "string", format: "date-time" }
            }
          },
          examples: {
            "Schedule text message": {
              value: {
                phone: "5521999999999",
                message: "Mensagem agendada!",
                type: "text",
                scheduledAt: "2026-03-01T10:00:00.000Z"
              }
            },
            "Schedule file": {
              value: {
                phone: "5521999999999",
                message: "Segue o arquivo",
                type: "file",
                payload: { base64: "<base64>", filename: "doc.pdf" },
                scheduledAt: "2026-03-01T10:00:00.000Z"
              }
            },
            "Schedule image": {
              value: {
                phone: "5521999999999",
                message: "Olha essa imagem",
                type: "image",
                payload: { base64: "<base64>", filename: "foto.jpg" },
                scheduledAt: "2026-03-01T10:00:00.000Z"
              }
            },
            "Schedule location": {
              value: {
                phone: "5521999999999",
                type: "location",
                payload: { lat: "-22.9068", lng: "-43.1729", title: "Rio", address: "Rio de Janeiro" },
                scheduledAt: "2026-03-01T10:00:00.000Z"
              }
            },
            "Schedule link preview": {
              value: {
                phone: "5521999999999",
                message: "Confere esse link",
                type: "link",
                payload: { url: "https://example.com", caption: "Meu link" },
                scheduledAt: "2026-03-01T10:00:00.000Z"
              }
            }
          }
        }
      }
     }
   */
  const session = req.session;
  const { phone, message, type, payload, scheduledAt } = req.body;

  if (!phone || !scheduledAt) {
    return res.status(400).json({ status: 'error', message: 'phone and scheduledAt are required' });
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    return res.status(400).json({ status: 'error', message: 'scheduledAt must be a valid future date' });
  }

  try {
    const { Schedule } = await getModels(session);
    const doc = await Schedule.create({
      phone,
      message: message || '',
      type: type || 'text',
      payload: payload || {},
      scheduledAt: scheduledDate,
      status: 'pending',
    });

    const delay = scheduledDate.getTime() - Date.now();
    await scheduleQueue.add(
      'send-scheduled',
      { scheduleId: doc._id.toString(), session },
      { delay, jobId: `schedule_${doc._id}`, removeOnComplete: true, removeOnFail: false }
    );

    return res.status(201).json({ status: 'success', response: doc });
  } catch (error) {
    req.logger.error(error);
    return res.status(500).json({ status: 'error', message: 'Error creating schedule', error });
  }
}

export async function listSchedules(req: Request, res: Response) {
  /**
     #swagger.tags = ["Schedule"]
     #swagger.autoBody=false
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.parameters["status"] = {
      in: "query",
      schema: 'pending'
     }
     #swagger.parameters["page"] = {
      in: "query",
      schema: '1'
     }
     #swagger.parameters["limit"] = {
      in: "query",
      schema: '20'
     }
   */
  const session = req.session;

  try {
    const { Schedule } = await getModels(session);
    const filter: any = {};
    if (req.query.status) filter.status = req.query.status;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Schedule.find(filter).sort({ scheduledAt: 1 }).skip(skip).limit(limit).lean(),
      Schedule.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data,
    });
  } catch (error) {
    req.logger.error(error);
    return res.status(500).json({ status: 'error', message: 'Error listing schedules', error });
  }
}

export async function getSchedule(req: Request, res: Response) {
  /**
     #swagger.tags = ["Schedule"]
     #swagger.autoBody=false
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.parameters["id"] = {
      schema: '<schedule_id>'
     }
   */
  const session = req.session;
  const { id } = req.params;

  try {
    const { Schedule } = await getModels(session);
    const doc = await Schedule.findById(id).lean();
    if (!doc) {
      return res.status(404).json({ status: 'error', message: 'Schedule not found' });
    }
    return res.status(200).json({ status: 'success', response: doc });
  } catch (error) {
    req.logger.error(error);
    return res.status(500).json({ status: 'error', message: 'Error fetching schedule', error });
  }
}

export async function updateSchedule(req: Request, res: Response) {
  /**
     #swagger.tags = ["Schedule"]
     #swagger.autoBody=false
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.parameters["id"] = {
      schema: '<schedule_id>'
     }
     #swagger.requestBody = {
      required: true,
      "@content": {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              phone: { type: "string" },
              message: { type: "string" },
              type: { type: "string", enum: ["text","file","image","location","link"] },
              payload: { type: "object" },
              scheduledAt: { type: "string", format: "date-time" }
            }
          }
        }
      }
     }
   */
  const session = req.session;
  const { id } = req.params;
  const { phone, message, type, payload, scheduledAt } = req.body;

  try {
    const { Schedule } = await getModels(session);
    const doc = await Schedule.findById(id);
    if (!doc) {
      return res.status(404).json({ status: 'error', message: 'Schedule not found' });
    }
    if (doc.status !== 'pending') {
      return res.status(400).json({ status: 'error', message: 'Only pending schedules can be updated' });
    }

    if (phone) doc.phone = phone;
    if (message !== undefined) doc.message = message;
    if (type) doc.type = type;
    if (payload) doc.payload = payload;

    if (scheduledAt) {
      const newDate = new Date(scheduledAt);
      if (isNaN(newDate.getTime()) || newDate <= new Date()) {
        return res.status(400).json({ status: 'error', message: 'scheduledAt must be a valid future date' });
      }
      doc.scheduledAt = newDate;

      // Remove old job and create new one with updated delay
      try { await scheduleQueue.remove(`schedule_${id}`); } catch {}
      const delay = newDate.getTime() - Date.now();
      await scheduleQueue.add(
        'send-scheduled',
        { scheduleId: id, session },
        { delay, jobId: `schedule_${id}`, removeOnComplete: true, removeOnFail: false }
      );
    }

    await doc.save();
    return res.status(200).json({ status: 'success', response: doc });
  } catch (error) {
    req.logger.error(error);
    return res.status(500).json({ status: 'error', message: 'Error updating schedule', error });
  }
}

export async function cancelSchedule(req: Request, res: Response) {
  /**
     #swagger.tags = ["Schedule"]
     #swagger.autoBody=false
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.parameters["id"] = {
      schema: '<schedule_id>'
     }
   */
  const session = req.session;
  const { id } = req.params;

  try {
    const { Schedule } = await getModels(session);
    const doc = await Schedule.findById(id);
    if (!doc) {
      return res.status(404).json({ status: 'error', message: 'Schedule not found' });
    }
    if (doc.status !== 'pending') {
      return res.status(400).json({ status: 'error', message: 'Only pending schedules can be cancelled' });
    }

    doc.status = 'cancelled';
    await doc.save();

    // Remove BullMQ job
    try { await scheduleQueue.remove(`schedule_${id}`); } catch {}

    return res.status(200).json({ status: 'success', response: doc });
  } catch (error) {
    req.logger.error(error);
    return res.status(500).json({ status: 'error', message: 'Error cancelling schedule', error });
  }
}

export async function deleteSchedule(req: Request, res: Response) {
  /**
     #swagger.tags = ["Schedule"]
     #swagger.autoBody=false
     #swagger.parameters["session"] = {
      schema: 'NERDWHATS_AMERICA'
     }
     #swagger.parameters["id"] = {
      schema: '<schedule_id>'
     }
   */
  const session = req.session;
  const { id } = req.params;

  try {
    const { Schedule } = await getModels(session);
    const doc = await Schedule.findById(id);
    if (!doc) {
      return res.status(404).json({ status: 'error', message: 'Schedule not found' });
    }

    // Remove BullMQ job if still pending
    if (doc.status === 'pending') {
      try { await scheduleQueue.remove(`schedule_${id}`); } catch {}
    }

    await Schedule.deleteOne({ _id: id });
    return res.status(200).json({ status: 'success', message: 'Schedule deleted' });
  } catch (error) {
    req.logger.error(error);
    return res.status(500).json({ status: 'error', message: 'Error deleting schedule', error });
  }
}
