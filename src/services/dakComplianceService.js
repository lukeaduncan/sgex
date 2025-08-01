/**
 * DAK Compliance Service
 * 
 * Provides comprehensive validation for DAK components with support for error, warning, and info levels.
 * Designed to work in multiple environments: React client-side, command-line, and IDE integration.
 */

class DAKComplianceService {
  constructor() {
    this.validators = new Map();
    this.initializeDefaultValidators();
  }

  /**
   * Initialize default validators for common DAK file types
   */
  initializeDefaultValidators() {
    // XML file validators (general)
    this.addValidator('xml', 'xml-well-formed', {
      level: 'error',
      description: 'XML files must be well-formed',
      validator: this.validateXMLWellFormed.bind(this)
    });

    // BPMN file validators
    this.addValidator('bpmn', 'xml-well-formed', {
      level: 'error',
      description: 'BPMN files must be well-formed XML',
      validator: this.validateXMLWellFormed.bind(this)
    });

    this.addValidator('bpmn', 'bpmn-namespace', {
      level: 'error',
      description: 'BPMN files must use correct BPMN 2.0 namespace',
      validator: this.validateBPMNNamespace.bind(this)
    });

    this.addValidator('bpmn', 'has-start-event', {
      level: 'warning',
      description: 'BPMN process should have at least one start event',
      validator: this.validateBPMNStartEvent.bind(this)
    });

    // DMN file validators
    this.addValidator('dmn', 'xml-well-formed', {
      level: 'error',
      description: 'DMN files must be well-formed XML',
      validator: this.validateXMLWellFormed.bind(this)
    });

    this.addValidator('dmn', 'dmn-namespace', {
      level: 'error',
      description: 'DMN files must use correct DMN 1.3 namespace',
      validator: this.validateDMNNamespace.bind(this)
    });

    // JSON file validators
    this.addValidator('json', 'json-valid', {
      level: 'error',
      description: 'JSON files must be valid JSON',
      validator: this.validateJSONSyntax.bind(this)
    });

    // FHIR resource validators
    this.addValidator('json', 'fhir-resource-type', {
      level: 'info',
      description: 'FHIR resources should have valid resourceType',
      validator: this.validateFHIRResourceType.bind(this)
    });

    // General file validators
    this.addValidator('*', 'file-size-limit', {
      level: 'warning',
      description: 'Files should be under 1MB for optimal performance',
      validator: this.validateFileSize.bind(this)
    });

    this.addValidator('*', 'filename-conventions', {
      level: 'info',
      description: 'Files should follow naming conventions',
      validator: this.validateFilenameConventions.bind(this)
    });

    // WHO SMART Guidelines specific validators
    this.addValidator('yaml', 'sushi-config-valid', {
      level: 'error',
      description: 'sushi-config.yaml must be valid and contain required fields',
      validator: this.validateSushiConfig.bind(this)
    });
  }

  /**
   * Add a new validator
   */
  addValidator(fileType, validatorId, config) {
    if (!this.validators.has(fileType)) {
      this.validators.set(fileType, new Map());
    }
    this.validators.get(fileType).set(validatorId, config);
  }

  /**
   * Remove a validator
   */
  removeValidator(fileType, validatorId) {
    if (this.validators.has(fileType)) {
      this.validators.get(fileType).delete(validatorId);
    }
  }

  /**
   * Validate a single file
   */
  async validateFile(filePath, content) {
    const results = [];
    const fileExtension = this.getFileExtension(filePath);
    const fileName = this.getFileName(filePath);

    // Get validators for this file type and universal validators
    const typeValidators = this.validators.get(fileExtension) || new Map();
    const universalValidators = this.validators.get('*') || new Map();

    // Run type-specific validators
    for (const [validatorId, config] of typeValidators) {
      try {
        const result = await config.validator(filePath, content, fileName);
        if (result) {
          results.push({
            validatorId,
            level: config.level,
            description: config.description,
            ...result
          });
        }
      } catch (error) {
        results.push({
          validatorId,
          level: 'error',
          description: 'Validator execution failed',
          message: error.message,
          filePath
        });
      }
    }

    // Run universal validators
    for (const [validatorId, config] of universalValidators) {
      try {
        const result = await config.validator(filePath, content, fileName);
        if (result) {
          results.push({
            validatorId,
            level: config.level,
            description: config.description,
            ...result
          });
        }
      } catch (error) {
        results.push({
          validatorId,
          level: 'error',
          description: 'Validator execution failed',
          message: error.message,
          filePath
        });
      }
    }

    return results;
  }

  /**
   * Validate entire staging ground
   */
  async validateStagingGround(stagingGround) {
    const results = {
      summary: { error: 0, warning: 0, info: 0 },
      files: {},
      validatedAt: Date.now()
    };

    for (const file of stagingGround.files) {
      const fileResults = await this.validateFile(file.path, file.content);
      results.files[file.path] = fileResults;

      // Update summary counts
      fileResults.forEach(result => {
        if (result.level === 'error') results.summary.error++;
        else if (result.level === 'warning') results.summary.warning++;
        else if (result.level === 'info') results.summary.info++;
      });
    }

    return results;
  }

  /**
   * Check if staging ground can be saved (no error-level violations)
   */
  async canSave(stagingGround) {
    const validation = await this.validateStagingGround(stagingGround);
    return validation.summary.error === 0;
  }

  // Validator implementations

  async validateXMLWellFormed(filePath, content) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/xml');
      const parserError = doc.querySelector('parsererror');
      
      if (parserError) {
        return {
          message: 'XML is not well-formed: ' + parserError.textContent,
          filePath
        };
      }
      return null;
    } catch (error) {
      return {
        message: 'Failed to parse XML: ' + error.message,
        filePath
      };
    }
  }

  async validateBPMNNamespace(filePath, content) {
    if (!content.includes('xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"')) {
      return {
        message: 'BPMN file missing correct BPMN 2.0 namespace declaration',
        filePath,
        suggestion: 'Add xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" to root element'
      };
    }
    return null;
  }

  async validateBPMNStartEvent(filePath, content) {
    if (!content.includes('<startEvent') && !content.includes('<bpmn:startEvent')) {
      return {
        message: 'BPMN process should contain at least one start event',
        filePath,
        suggestion: 'Add a start event to begin the process flow'
      };
    }
    return null;
  }

  async validateDMNNamespace(filePath, content) {
    if (!content.includes('xmlns:dmn="https://www.omg.org/spec/DMN/20191111/MODEL/"')) {
      return {
        message: 'DMN file missing correct DMN 1.3 namespace declaration',
        filePath,
        suggestion: 'Add xmlns:dmn="https://www.omg.org/spec/DMN/20191111/MODEL/" to root element'
      };
    }
    return null;
  }

  async validateJSONSyntax(filePath, content) {
    try {
      JSON.parse(content);
      return null;
    } catch (error) {
      return {
        message: 'Invalid JSON syntax: ' + error.message,
        filePath
      };
    }
  }

  async validateFHIRResourceType(filePath, content) {
    try {
      const json = JSON.parse(content);
      const validResourceTypes = [
        'StructureDefinition', 'ValueSet', 'CodeSystem', 'ConceptMap',
        'Questionnaire', 'PlanDefinition', 'ActivityDefinition', 'Measure',
        'Library', 'ImplementationGuide', 'Bundle', 'Patient', 'Practitioner'
      ];

      if (json.resourceType && !validResourceTypes.includes(json.resourceType)) {
        return {
          message: `Unknown FHIR resourceType: ${json.resourceType}`,
          filePath,
          suggestion: 'Verify the resourceType is correct for FHIR R4'
        };
      }
      return null;
    } catch (error) {
      // Not JSON, skip this validator
      return null;
    }
  }

  async validateFileSize(filePath, content) {
    const sizeInBytes = new Blob([content]).size;
    const maxSize = 1024 * 1024; // 1MB

    if (sizeInBytes > maxSize) {
      return {
        message: `File size (${(sizeInBytes / 1024 / 1024).toFixed(1)}MB) exceeds recommended limit of 1MB`,
        filePath,
        suggestion: 'Consider breaking large files into smaller components'
      };
    }
    return null;
  }

  async validateFilenameConventions(filePath, content) {
    const fileName = this.getFileName(filePath);
    const issues = [];

    // Check for spaces in filename
    if (fileName.includes(' ')) {
      issues.push('avoid spaces in filenames');
    }

    // Check for special characters
    if (/[<>:"|?*]/.test(fileName)) {
      issues.push('avoid special characters (<>:"|?*)');
    }

    // Check for very long names
    if (fileName.length > 100) {
      issues.push('filename is very long (>100 characters)');
    }

    if (issues.length > 0) {
      return {
        message: `Filename convention issues: ${issues.join(', ')}`,
        filePath,
        suggestion: 'Use lowercase letters, numbers, hyphens, and underscores'
      };
    }
    return null;
  }

  async validateSushiConfig(filePath, content) {
    if (!filePath.endsWith('sushi-config.yaml')) {
      return null;
    }

    try {
      // Basic YAML parsing (would need js-yaml library for full implementation)
      const lines = content.split('\n');
      const hasName = lines.some(line => line.trim().startsWith('name:'));
      const hasId = lines.some(line => line.trim().startsWith('id:'));
      const hasDependencies = lines.some(line => line.trim().startsWith('dependencies:'));

      const issues = [];
      if (!hasName) issues.push('missing "name" field');
      if (!hasId) issues.push('missing "id" field');
      if (!hasDependencies) issues.push('missing "dependencies" section');

      if (issues.length > 0) {
        return {
          message: `sushi-config.yaml validation issues: ${issues.join(', ')}`,
          filePath,
          suggestion: 'Ensure required fields are present for FHIR IG'
        };
      }
      return null;
    } catch (error) {
      return {
        message: 'Failed to validate sushi-config.yaml: ' + error.message,
        filePath
      };
    }
  }

  // Utility methods

  getFileExtension(filePath) {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  getFileName(filePath) {
    return filePath.split('/').pop() || filePath;
  }

  /**
   * Format validation results for display
   */
  formatValidationResults(validation) {
    const formatted = {
      canSave: validation.summary.error === 0,
      summary: validation.summary,
      files: []
    };

    Object.entries(validation.files).forEach(([filePath, results]) => {
      if (results.length > 0) {
        formatted.files.push({
          path: filePath,
          issues: results.map(result => ({
            level: result.level,
            message: result.message,
            description: result.description,
            suggestion: result.suggestion
          }))
        });
      }
    });

    return formatted;
  }

  /**
   * Get validation summary for UI display
   */
  getValidationSummary(validation) {
    return {
      error: validation.summary.error,
      warning: validation.summary.warning,
      info: validation.summary.info,
      canSave: validation.summary.error === 0,
      hasIssues: validation.summary.error + validation.summary.warning + validation.summary.info > 0
    };
  }
}

// Create singleton instance
const dakComplianceService = new DAKComplianceService();

export default dakComplianceService;