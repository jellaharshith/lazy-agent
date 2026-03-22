import { createResource, getAvailableResources, listResourcesByProviderId } from '../db/resources';
import { CreateResourceInput, Resource } from '../types';

export async function listAvailableResources(): Promise<Resource[]> {
  return getAvailableResources();
}

export async function createNewResource(input: CreateResourceInput): Promise<Resource> {
  return createResource(input);
}

export async function listResourcesForProvider(providerId: string): Promise<Resource[]> {
  return listResourcesByProviderId(providerId);
}
