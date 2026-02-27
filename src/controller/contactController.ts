import { Request, Response } from 'express';

import { getModels } from '../util/db/mongo';

export default class ContactController {
  static async listContacts(req: Request, res: Response) {
    /**
      #swagger.tags = ["Contact"]
      #swagger.autoBody=false
      #swagger.parameters["session"] = {
          schema: 'NERDWHATS_AMERICA'
      }
      #swagger.parameters["page"] = {
          in: 'query',
          schema: '1'
      }
      #swagger.parameters["limit"] = {
          in: 'query',
          schema: '100'
      }
      #swagger.parameters["search"] = {
          in: 'query',
          schema: ''
      }
      */
    try {
      const session = req.params.session || process.env.SESSION_NAME || 'default';
      const { Contact } = await getModels(session);

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 100));
      const skip = (page - 1) * limit;

      const filter: any = {};
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { pushname: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { wa_id: { $regex: search, $options: 'i' } },
        ];
      }

      const [contacts, total] = await Promise.all([
        Contact.find(filter, { raw: 0 }).sort({ name: 1 }).skip(skip).limit(limit).lean(),
        Contact.countDocuments(filter),
      ]);

      return res.status(200).json({
        status: 'success',
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        data: contacts,
      });
    } catch (error) {
      req.logger.error(error);
      return res.status(500).json({
        status: 'error',
        message: 'Error listing contacts from database',
        error: String(error),
      });
    }
  }

  static async getContactPnLid(req: Request, res: Response) {
    /**
      #swagger.tags = ["Contact"]
      #swagger.autoBody=false
      #swagger.parameters["session"] = {
          schema: 'NERDWHATS_AMERICA'
      }
      #swagger.parameters["pnLid"] = {
          schema: '1234567890@c.us' // or '1234567890@lid'
      }
      */
    const { pnLid } = req.params;

    if (!pnLid) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone Number or LID (pnLid) parameter is required',
      });
    }

    try {
      const response = await req.client.getPnLidEntry(pnLid);
      res.status(200).json(response);
    } catch (error) {
      req.logger.error(error);
      res.status(500).json({
        status: 'error',
        message: 'Error on get contact by PN-LID',
        error: error,
      });
    }
  }
}
