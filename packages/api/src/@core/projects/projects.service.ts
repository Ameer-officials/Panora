import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../logger/logger.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { v4 as uuidv4 } from 'uuid';
import { handleServiceError } from '@@core/utils/errors';
import {
  ConnectorCategory,
  providersArray,
  slugFromCategory,
} from '@panora/shared';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService, private logger: LoggerService) {
    this.logger.setContext(ProjectsService.name);
  }

  async getProjects() {
    try {
      return await this.prisma.projects.findMany();
    } catch (error) {
      handleServiceError(error, this.logger);
    }
  }

  async getProjectsByUser(userId: string) {
    try {
      return await this.prisma.projects.findMany({
        where: {
          id_user: userId,
        },
      });
    } catch (error) {
      handleServiceError(error, this.logger);
    }
  }

  async createProject(data: CreateProjectDto) {
    try {
      const ACTIVE_CONNECTORS = providersArray();
      // update project-connectors table for the project
      const updateData: any = {
        id_connector_set: uuidv4(),
      };

      ACTIVE_CONNECTORS.forEach((connector) => {
        if (connector.vertical) {
          // Construct the property name using the vertical name
          const propertyName = `${slugFromCategory(
            connector.vertical as ConnectorCategory,
          )}_`;
          // Add the property to updateData with a value of true
          updateData[propertyName + connector.name] = true;
        }
      });
      const cSet = await this.prisma.connector_sets.create({
        data: updateData,
      });

      const res = await this.prisma.projects.create({
        data: {
          name: data.name,
          sync_mode: 'pool',
          id_project: uuidv4(),
          id_user: data.id_user,
          id_connector_set: cSet.id_connector_set,
        },
      });

      const ACTIVE_CONNECTORS = providersArray();
      // update project-connectors table for the project
      const updateData: any = {
        id_project_connector: uuidv4(),
        id_project: res.id_project,
      };

      ACTIVE_CONNECTORS.forEach((connector) => {
        if (connector.vertical) {
          // Construct the property name using the vertical name
          const propertyName = `${slugFromCategory(
            connector.vertical as ConnectorCategory,
          )}_`;
          // Add the property to updateData with a value of true
          updateData[propertyName + connector.name] = true;
        }
      });
      await this.prisma.project_connectors.create({
        data: updateData,
      });
      return res;
    } catch (error) {
      handleServiceError(error, this.logger);
    }
  }
}
